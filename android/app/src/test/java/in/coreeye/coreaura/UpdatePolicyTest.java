package in.coreeye.coreaura;
import org.junit.Test;
import static org.junit.Assert.*;
public class UpdatePolicyTest {
    private final String hash=new String(new char[64]).replace('\0','a'), cert=new String(new char[64]).replace('\0','b');
    private UpdatePolicy.Spec spec(String url,long code) {return new UpdatePolicy.Spec(UpdatePolicy.APP_ID,"0.23.0",code,23,url,hash,cert,8000000);}
    private String url() {return "https://core-aura.coreeye.in/android/releases/"+hash+"/core-aura-0.23.0.apk";}
    @Test public void onlyExactOfficialApkMetadataIsAccepted() {
        assertEquals(23,spec(url(),23).versionCode);
        for(String value:new String[]{url()+"?elsewhere=1",url().replace(hash,"c"+hash.substring(1)),url().replace("0.23.0","0.24.0"),url().replace("https:","http:"),"https://core-aura.coreeye.in/download.html"}) {
            try {spec(value,23);fail(value);}catch(IllegalArgumentException expected){}
        }
        try {spec(url(),0);fail();}catch(IllegalArgumentException expected){}
    }
    @Test public void verifiesSelfUpdateIdentityCertificateAndNewerVersion() {
        UpdatePolicy.Spec s=spec(url(),23);
        UpdatePolicy.identity(s,UpdatePolicy.APP_ID,cert,22,34,UpdatePolicy.APP_ID,cert,23,"0.23.0");
        Object[][] bad={{"other",cert,23L,"0.23.0"},{UpdatePolicy.APP_ID,hash,23L,"0.23.0"},{UpdatePolicy.APP_ID,cert,22L,"0.23.0"},{UpdatePolicy.APP_ID,cert,24L,"0.24.0"}};
        for(Object[] row:bad)try {UpdatePolicy.identity(s,UpdatePolicy.APP_ID,cert,22,34,(String)row[0],(String)row[1],(Long)row[2],(String)row[3]);fail();}catch(IllegalArgumentException expected){}
        try {UpdatePolicy.identity(s,UpdatePolicy.APP_ID,cert,23,34,UpdatePolicy.APP_ID,cert,23,"0.23.0");fail();}catch(IllegalArgumentException expected){}
        try {UpdatePolicy.identity(s,UpdatePolicy.APP_ID,cert,22,22,UpdatePolicy.APP_ID,cert,23,"0.23.0");fail();}catch(IllegalArgumentException expected){}
    }
}
