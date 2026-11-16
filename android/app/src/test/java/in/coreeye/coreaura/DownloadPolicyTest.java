package in.coreeye.coreaura;
import org.junit.Test;
import static org.junit.Assert.*;
public class DownloadPolicyTest {
    @Test public void permitsOnlyOfficialImmutableApksAndHelpPage() {
        String hash = new String(new char[64]).replace('\0', 'a');
        assertTrue(DownloadPolicy.allowed("https://core-aura.coreeye.in/download.html"));
        assertTrue(DownloadPolicy.allowed("https://core-aura.coreeye.in/android/releases/" + hash + "/core-aura-0.19.0.apk"));
        for (String url : new String[]{null, "http://core-aura.coreeye.in/download.html", "https://example.org/download.html", "https://core-aura.coreeye.in:444/download.html", "https://name@core-aura.coreeye.in/download.html", "https://core-aura.coreeye.in/download.html?url=elsewhere", "https://core-aura.coreeye.in/download.html#other", "https://core-aura.coreeye.in/android/../private.apk", "https://core-aura.coreeye.in/android/releases/wrong/core-aura-0.19.0.apk"}) assertFalse(String.valueOf(url), DownloadPolicy.allowed(url));
    }
}
