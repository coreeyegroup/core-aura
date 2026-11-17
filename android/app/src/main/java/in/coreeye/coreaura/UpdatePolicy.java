package in.coreeye.coreaura;

import java.net.URI;

/** Restrictions shared by the native installer and its JVM tests. */
public final class UpdatePolicy {
    private UpdatePolicy() {}
    public static final String APP_ID = "in.coreeye.coreaura";
    public static final long MAX_BYTES = 150L * 1024 * 1024;
    public static final class Spec {
        public final String url, sha256, certificate, versionName;
        public final long size, versionCode;
        public final int minSdk;
        public Spec(String applicationId, String versionName, long versionCode, int minSdk, String url, String sha256, String certificate, long size) {
            if (!APP_ID.equals(applicationId) || versionName == null || !versionName.matches("[0-9]+\\.[0-9]+\\.[0-9]+") || versionCode < 1 || versionCode > 2100000000L || minSdk < 23 || minSdk > 100 || size < 1000 || size > MAX_BYTES || !hash(sha256) || !hash(certificate))
                throw new IllegalArgumentException("Invalid Android update information.");
            try {
                URI uri = new URI(url);
                String expected = "/android/releases/" + sha256 + "/core-aura-" + versionName + ".apk";
                if (!DownloadPolicy.allowed(url) || !expected.equals(uri.getRawPath())) throw new Exception();
            } catch (Exception error) { throw new IllegalArgumentException("Only the official immutable APK address is allowed."); }
            this.url=url; this.sha256=sha256; this.certificate=certificate; this.versionName=versionName; this.versionCode=versionCode; this.minSdk=minSdk; this.size=size;
        }
    }
    private static boolean hash(String value) { return value != null && value.matches("[a-f0-9]{64}"); }
    public static void identity(Spec spec, String installedId, String installedCertificate, long installedCode, int sdk, String archiveId, String archiveCertificate, long archiveCode, String archiveName) {
        if (!APP_ID.equals(installedId) || !APP_ID.equals(archiveId)) throw new IllegalArgumentException("The update is for a different application.");
        if (!spec.certificate.equals(installedCertificate) || !installedCertificate.equals(archiveCertificate)) throw new IllegalArgumentException("The update signing identity does not match this app. Keep the installed app and contact the owner.");
        if (spec.versionCode <= installedCode || archiveCode != spec.versionCode || !spec.versionName.equals(archiveName)) throw new IllegalArgumentException("The APK is not the expected newer version of this app.");
        if (sdk < spec.minSdk) throw new IllegalArgumentException("This update does not support this Android version.");
    }
}
