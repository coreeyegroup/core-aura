package in.coreeye.coreaura;

import java.net.URI;

public final class DownloadPolicy {
    private DownloadPolicy() {}
    public static boolean allowed(String value) {
        if (value == null) return false;
        try {
            URI uri = new URI(value);
            String path = uri.getPath();
            return "https".equals(uri.getScheme()) && "core-aura.coreeye.in".equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null
                && uri.getRawQuery() == null && uri.getRawFragment() == null && path != null
                && ("/download.html".equals(path) || path.matches("/android/releases/[a-f0-9]{64}/core-aura-[0-9]+\\.[0-9]+\\.[0-9]+\\.apk"));
        } catch (Exception error) { return false; }
    }
}
