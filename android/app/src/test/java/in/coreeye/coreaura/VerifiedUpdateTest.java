package in.coreeye.coreaura;
import org.junit.Test;
import org.junit.Rule;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.net.*;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;
public class VerifiedUpdateTest {
    @Rule public TemporaryFolder temporary=new TemporaryFolder();
    private final String cert=new String(new char[64]).replace('\0','b');
    private static class Response extends HttpURLConnection {
        byte[] bytes;int status;boolean disconnected;
        Response(URL url,byte[] bytes,int status){super(url);this.bytes=bytes;this.status=status;}
        public void connect(){} public void disconnect(){disconnected=true;} public boolean usingProxy(){return false;}
        public int getResponseCode(){return status;}
        public String getHeaderField(String field){return null;}
        public InputStream getInputStream(){return new ByteArrayInputStream(bytes);}
    }
    private UpdatePolicy.Spec spec(byte[] bytes) throws Exception {
        File file=temporary.newFile();try(FileOutputStream out=new FileOutputStream(file)){out.write(bytes);}
        String hash=VerifiedUpdate.digest(file);
        return new UpdatePolicy.Spec(UpdatePolicy.APP_ID,"0.23.0",23,23,"https://core-aura.coreeye.in/android/releases/"+hash+"/core-aura-0.23.0.apk",hash,cert,bytes.length);
    }
    @Test public void validatesAndReusesPrivateDownloadWithoutAnotherNetworkRequest() throws Exception {
        byte[] bytes=new byte[4096];Arrays.fill(bytes,(byte)42);UpdatePolicy.Spec s=spec(bytes);File dir=temporary.newFolder();
        Response response=new Response(new URL(s.url),bytes,200);
        File result=VerifiedUpdate.download(s,dir,()->false,(a,b)->{},url->response);
        assertEquals(s.sha256,VerifiedUpdate.digest(result));assertTrue(response.disconnected);assertFalse(response.getInstanceFollowRedirects());assertEquals("identity",response.getRequestProperty("Accept-Encoding"));
        assertEquals(result,VerifiedUpdate.download(s,dir,()->false,(a,b)->{},url->{throw new AssertionError("Verified cache must be reused");}));
    }
    @Test public void rejectsTruncationOversizeRedirectAndCorruptionWithoutInstallableFiles() throws Exception {
        byte[] bytes=new byte[2048];Arrays.fill(bytes,(byte)7);UpdatePolicy.Spec s=spec(bytes);
        byte[] corrupted=bytes.clone();corrupted[20]=8;
        for(byte[] body:new byte[][]{Arrays.copyOf(bytes,2047),Arrays.copyOf(bytes,2049),corrupted}) {
            File dir=temporary.newFolder();try {VerifiedUpdate.download(s,dir,()->false,(a,b)->{},url->new Response(url,body,200));fail();}catch(IOException expected){}
            assertEquals(0,dir.listFiles().length);
        }
        File dir=temporary.newFolder();try {VerifiedUpdate.download(s,dir,()->false,(a,b)->{},url->new Response(url,bytes,302));fail();}catch(IOException expected){}
        assertEquals(0,dir.listFiles().length);
    }
    @Test public void cancelsPartialDownloadAndRetriesCleanly() throws Exception {
        byte[] bytes=new byte[70000];Arrays.fill(bytes,(byte)8);UpdatePolicy.Spec s=spec(bytes);File dir=temporary.newFolder();AtomicBoolean cancelled=new AtomicBoolean();
        try {VerifiedUpdate.download(s,dir,cancelled::get,(a,b)->cancelled.set(true),url->new Response(url,bytes,200));fail();}catch(IOException expected){assertTrue(expected.getMessage().contains("cancelled"));}
        assertEquals(0,dir.listFiles().length);
        assertEquals(s.size,VerifiedUpdate.download(s,dir,()->false,(a,b)->{},url->new Response(url,bytes,200)).length());
    }
}
