package app.myra.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import androidx.annotation.Nullable;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Native Android media surface for the notification shade and lock screen.
 * Playback itself stays in the Capacitor WebView; this service owns the system
 * MediaSession and forwards every transport command back to React.
 */
public class MyraPlaybackService extends Service {
    public static final String ACTION_UPDATE = "app.myra.music.media.UPDATE";
    public static final String ACTION_COMMAND = "app.myra.music.media.COMMAND";
    public static final String ACTION_STOP = "app.myra.music.media.STOP";
    public static final String BROADCAST_COMMAND = "app.myra.music.media.COMMAND_EVENT";
    public static final String BROADCAST_ERROR = "app.myra.music.media.ERROR_EVENT";

    public static final String EXTRA_COMMAND = "command";
    public static final String EXTRA_ID = "id";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_ARTWORK = "artwork";
    public static final String EXTRA_PLAYING = "playing";
    public static final String EXTRA_LIKED = "liked";
    public static final String EXTRA_DURATION = "duration";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_MESSAGE = "message";

    private static final String CHANNEL_ID = "myra_playback";
    private static final int NOTIFICATION_ID = 5267;
    // MediaSession metadata crosses Android's Binder boundary. A 512–768 px
    // ARGB bitmap can exceed the ~1 MB transaction budget and crash the app
    // before the notification is shown. 256 px is sharp in the system card
    // while staying safely below that boundary.
    private static final int MAX_ARTWORK_PX = 256;
    private static final int MAX_ARTWORK_BYTES = 3 * 1024 * 1024;
    private static final int MAX_DECODE_PX = 512;
    private static final String CUSTOM_FLOW = "myra_flow";
    private static final String CUSTOM_LIKE = "myra_like";

    private final ExecutorService artworkExecutor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private NotificationManager notificationManager;
    private MediaSession mediaSession;
    private String trackId = "";
    private String title = "MYRA";
    private String artist = "";
    private String album = "";
    private String artworkSource = "";
    private Bitmap artwork;
    private boolean playing;
    private boolean liked;
    private boolean destroyed;
    private long durationMs;
    private long positionMs;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        createNotificationChannel();

        mediaSession = new MediaSession(this, "MYRA Playback");
        mediaSession.setFlags(
            MediaSession.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { handleCommand("play"); }
            @Override public void onPause() { handleCommand("pause"); }
            @Override public void onSkipToNext() { handleCommand("next"); }
            @Override public void onSkipToPrevious() { handleCommand("previous"); }
            @Override public void onSeekTo(long pos) { handleSeek(pos); }

            @Override
            public void onCustomAction(String action, Bundle extras) {
                if (CUSTOM_FLOW.equals(action)) handleCommand("flow");
                if (CUSTOM_LIKE.equals(action)) handleCommand("like");
            }
        });
        mediaSession.setActive(true);
        artwork = fitArtwork(BitmapFactory.decodeResource(getResources(), R.drawable.myra_app_icon_reference));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        try {
            String action = intent.getAction();
            if (ACTION_STOP.equals(action)) {
                stopPlaybackSurface();
                return START_NOT_STICKY;
            }
            if (ACTION_COMMAND.equals(action)) {
                handleCommand(intent.getStringExtra(EXTRA_COMMAND));
                return START_NOT_STICKY;
            }
            if (ACTION_UPDATE.equals(action)) {
                applyUpdate(intent);
                publish();
            }
        } catch (Throwable error) {
            // A broken system surface must never take down the whole WebView.
            Log.e("MYRA_MEDIA", "Unable to publish Android media controls", error);
            sendError(error);
            stopPlaybackSurface();
        }
        return START_NOT_STICKY;
    }

    private void applyUpdate(Intent intent) {
        trackId = intent.getStringExtra(EXTRA_ID);
        title = valueOr(intent.getStringExtra(EXTRA_TITLE), "MYRA");
        artist = valueOr(intent.getStringExtra(EXTRA_ARTIST), "");
        album = valueOr(intent.getStringExtra(EXTRA_ALBUM), "");
        playing = intent.getBooleanExtra(EXTRA_PLAYING, false);
        liked = intent.getBooleanExtra(EXTRA_LIKED, false);
        durationMs = Math.max(0L, Math.round(intent.getDoubleExtra(EXTRA_DURATION, 0) * 1000));
        positionMs = clamp(
            Math.round(intent.getDoubleExtra(EXTRA_POSITION, 0) * 1000),
            0,
            durationMs > 0 ? durationMs : Long.MAX_VALUE
        );

        String nextArtwork = valueOr(intent.getStringExtra(EXTRA_ARTWORK), "");
        if (!nextArtwork.isEmpty() && !nextArtwork.equals(artworkSource)) {
            artworkSource = nextArtwork;
            loadArtwork(nextArtwork);
        }
    }

    private void handleCommand(@Nullable String command) {
        if (command == null) return;
        switch (command) {
            case "play": playing = true; break;
            case "pause": playing = false; break;
            case "like": liked = !liked; break;
            case "dismiss":
                playing = false;
                sendCommand("pause");
                stopPlaybackSurface();
                return;
            default: break;
        }
        sendCommand(command);
        publish();
    }

    private void handleSeek(long requestedPositionMs) {
        positionMs = clamp(requestedPositionMs, 0, durationMs > 0 ? durationMs : Long.MAX_VALUE);
        Intent event = new Intent(BROADCAST_COMMAND);
        event.setPackage(getPackageName());
        event.putExtra(EXTRA_COMMAND, "seek");
        event.putExtra(EXTRA_POSITION, positionMs / 1000.0);
        sendBroadcast(event);
        publish();
    }

    private void sendCommand(String command) {
        Intent event = new Intent(BROADCAST_COMMAND);
        event.setPackage(getPackageName());
        event.putExtra(EXTRA_COMMAND, command);
        sendBroadcast(event);
    }

    private void publish() {
        if (destroyed) return;
        try {
            updateMediaSession();
            Notification notification = buildNotification();
            // The media surface must remain a real foreground service while a
            // track is selected, including PAUSED. Honor/MagicOS aggressively
            // removes detached low-priority media notifications after the
            // activity is backgrounded, which made the shade player appear to
            // work once and then disappear. An explicit STOP is still able to
            // remove the surface on logout/dismiss.
            startForeground(NOTIFICATION_ID, notification);
        } catch (Throwable error) {
            Log.e("MYRA_MEDIA", "Unable to update Android media controls", error);
            sendError(error);
            stopPlaybackSurface();
        }
    }

    private void updateMediaSession() {
        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_MEDIA_ID, valueOr(trackId, ""))
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs);
        if (artwork != null) {
            metadata.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, artwork);
        }
        mediaSession.setMetadata(metadata.build());

        long actions = PlaybackState.ACTION_PLAY |
            PlaybackState.ACTION_PAUSE |
            PlaybackState.ACTION_PLAY_PAUSE |
            PlaybackState.ACTION_SKIP_TO_NEXT |
            PlaybackState.ACTION_SKIP_TO_PREVIOUS |
            PlaybackState.ACTION_SEEK_TO;
        PlaybackState.Builder state = new PlaybackState.Builder()
            .setActions(actions)
            .setState(
                playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                positionMs,
                playing ? 1f : 0f
            )
            .addCustomAction(new PlaybackState.CustomAction.Builder(
                CUSTOM_FLOW,
                getString(R.string.media_flow),
                R.drawable.ic_myra_flow
            ).build())
            .addCustomAction(new PlaybackState.CustomAction.Builder(
                CUSTOM_LIKE,
                getString(liked ? R.string.media_unlike : R.string.media_like),
                liked ? R.drawable.ic_myra_heart_fill : R.drawable.ic_myra_heart
            ).build());
        mediaSession.setPlaybackState(state.build());
    }

    private Notification buildNotification() {
        Intent openApp = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            10,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);
        builder
            .setSmallIcon(R.drawable.ic_stat_myra)
            .setLargeIcon(artwork)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(getString(R.string.media_now_playing))
            .setContentIntent(contentIntent)
            .setDeleteIntent(commandIntent("dismiss", 99))
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setColor(Color.rgb(221, 143, 110))
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setOngoing(true)
            .addAction(action(R.drawable.ic_myra_flow, R.string.media_flow, "flow", 1))
            .addAction(action(R.drawable.ic_myra_previous, R.string.media_previous, "previous", 2))
            .addAction(action(
                playing ? R.drawable.ic_myra_pause : R.drawable.ic_myra_play,
                playing ? R.string.media_pause : R.string.media_play,
                playing ? "pause" : "play",
                3
            ))
            .addAction(action(R.drawable.ic_myra_next, R.string.media_next, "next", 4))
            .addAction(action(
                liked ? R.drawable.ic_myra_heart_fill : R.drawable.ic_myra_heart,
                liked ? R.string.media_unlike : R.string.media_like,
                "like",
                5
            ));

        Notification.MediaStyle style = new Notification.MediaStyle()
            .setMediaSession(mediaSession.getSessionToken())
            .setShowActionsInCompactView(1, 2, 3);
        builder.setStyle(style);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        }
        return builder.build();
    }

    private Notification.Action action(int icon, int label, String command, int requestCode) {
        return new Notification.Action.Builder(
            icon,
            getString(label),
            commandIntent(command, requestCode)
        ).build();
    }

    private PendingIntent commandIntent(String command, int requestCode) {
        Intent intent = new Intent(this, MyraPlaybackService.class);
        intent.setAction(ACTION_COMMAND);
        intent.putExtra(EXTRA_COMMAND, command);
        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.media_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.media_channel_description));
        channel.setShowBadge(false);
        channel.setSound(null, null);
        channel.enableVibration(false);
        notificationManager.createNotificationChannel(channel);
    }

    private void loadArtwork(String source) {
        artworkExecutor.execute(() -> {
            Bitmap loaded = decodeArtwork(source);
            if (loaded == null) return;
            Bitmap fitted = fitArtwork(loaded);
            mainHandler.post(() -> {
                if (destroyed || !source.equals(artworkSource)) return;
                artwork = fitted;
                publish();
            });
        });
    }

    private void sendError(Throwable error) {
        Intent event = new Intent(BROADCAST_ERROR);
        event.setPackage(getPackageName());
        String detail = error.getMessage();
        event.putExtra(EXTRA_MESSAGE, error.getClass().getSimpleName() + (detail == null ? "" : ": " + detail));
        sendBroadcast(event);
    }

    @Nullable
    private Bitmap decodeArtwork(String source) {
        try {
            if (source.startsWith("data:image/") && source.contains(";base64,")) {
                String encoded = source.substring(source.indexOf(',') + 1);
                // Base64 is roughly 4/3 of the decoded payload. Reject before
                // allocating the byte array as well as after decoding it.
                if (encoded.length() > (MAX_ARTWORK_BYTES * 4L / 3L) + 16L) return null;
                byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                if (bytes.length > MAX_ARTWORK_BYTES) return null;
                return decodeSampled(bytes);
            }
            if (source.startsWith("https://")) {
                HttpURLConnection connection = (HttpURLConnection) new URL(source).openConnection();
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);
                connection.setInstanceFollowRedirects(false);
                connection.setRequestProperty("Accept", "image/*");
                int responseCode = connection.getResponseCode();
                if (responseCode < 200 || responseCode >= 300) {
                    connection.disconnect();
                    return null;
                }
                String contentType = connection.getContentType();
                int contentLength = connection.getContentLength();
                if (contentType == null || !contentType.toLowerCase().startsWith("image/")) {
                    connection.disconnect();
                    return null;
                }
                if (contentLength > MAX_ARTWORK_BYTES) {
                    connection.disconnect();
                    return null;
                }
                try (InputStream stream = connection.getInputStream()) {
                    return decodeSampled(readBounded(stream));
                } finally {
                    connection.disconnect();
                }
            }
        } catch (Exception ignored) {
            // Keep the MYRA fallback artwork if a remote cover is unavailable.
        }
        return null;
    }

    private byte[] readBounded(InputStream stream) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream(64 * 1024);
        byte[] buffer = new byte[16 * 1024];
        int total = 0;
        int read;
        while ((read = stream.read(buffer)) != -1) {
            total += read;
            if (total > MAX_ARTWORK_BYTES) {
                throw new IOException("Artwork exceeds safe size");
            }
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    @Nullable
    private Bitmap decodeSampled(byte[] bytes) {
        if (bytes.length == 0 || bytes.length > MAX_ARTWORK_BYTES) return null;

        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

        BitmapFactory.Options options = new BitmapFactory.Options();
        int largest = Math.max(bounds.outWidth, bounds.outHeight);
        int sampleSize = 1;
        while (largest / sampleSize > MAX_DECODE_PX) {
            sampleSize *= 2;
        }
        options.inSampleSize = sampleSize;
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
    }

    @Nullable
    private Bitmap fitArtwork(@Nullable Bitmap source) {
        if (source == null) return null;
        int max = Math.max(source.getWidth(), source.getHeight());
        if (max <= MAX_ARTWORK_PX) return source;
        float scale = (float) MAX_ARTWORK_PX / max;
        return Bitmap.createScaledBitmap(
            source,
            Math.max(1, Math.round(source.getWidth() * scale)),
            Math.max(1, Math.round(source.getHeight() * scale)),
            true
        );
    }

    private void stopPlaybackSurface() {
        try {
            if (mediaSession != null) mediaSession.setActive(false);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
            if (notificationManager != null) notificationManager.cancel(NOTIFICATION_ID);
        } catch (RuntimeException cleanupError) {
            Log.w("MYRA_MEDIA", "Media cleanup failed", cleanupError);
        }
        stopSelf();
    }

    private static String valueOr(@Nullable String value, String fallback) {
        return value == null ? fallback : value;
    }

    private static long clamp(long value, long min, long max) {
        return Math.max(min, Math.min(value, max));
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        destroyed = true;
        mainHandler.removeCallbacksAndMessages(null);
        if (notificationManager != null) notificationManager.cancel(NOTIFICATION_ID);
        artworkExecutor.shutdownNow();
        if (mediaSession != null) mediaSession.release();
        super.onDestroy();
    }
}
