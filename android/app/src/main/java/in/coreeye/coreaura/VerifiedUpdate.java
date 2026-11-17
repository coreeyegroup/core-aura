package in.coreeye.coreaura;

import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.Locale;

/** Bounded private download; an interrupted or invalid file is never installable. */
public final class VerifiedUpdate {
    public interface Cancelled { boolean get(); }
    public interface Progress { void report(long received, long total); }
    public interface Connection { HttpURLConnection open(URL url) throws IOException; }
    private VerifiedUpdate() {}
    public static String digest(File file) throws Exception {
        MessageDigest hash=MessageDigest.getInstance("SHA-256");
        try (InputStream input=new FileInputStream(file)) {
            byte[] bytes=new byte[65536]; int count;
            while ((count=input.read(bytes))!=-1) hash.update(bytes,0,count);
        }
        StringBuilder result=new StringBuilder();
        for (byte value:hash.digest()) result.append(String.format(Locale.ROOT,"%02x",value & 255));
        return result.toString();
    }
    public static void check(Cancelled cancelled) throws IOException { if (cancelled.get()) throw new IOException("Update cancelled."); }
    public static File download(UpdatePolicy.Spec spec, File directory, Cancelled cancelled, Progress progress, Connection connections) throws Exception {
        check(cancelled);
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Update storage is unavailable.");
        File target=new File(directory,spec.sha256+".apk"), partial=new File(directory,spec.sha256+".part");
        if (target.isFile() && target.length()==spec.size && spec.sha256.equals(digest(target))) { check(cancelled); progress.report(spec.size,spec.size); return target; }
        File[] old=directory.listFiles();
        if (old!=null) for (File file:old) if (file.getName().matches("[a-f0-9]{64}\\.(apk|part)")) file.delete();
        HttpURLConnection connection=connections.open(new URL(spec.url));
        try {
            connection.setConnectTimeout(10000); connection.setReadTimeout(15000); connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept-Encoding","identity");
            connection.setRequestProperty("Accept","application/vnd.android.package-archive");
            check(cancelled);
            if (connection.getResponseCode()!=200) throw new IOException("The update file is unavailable. Please retry.");
            String length=connection.getHeaderField("Content-Length");
            long declared=length==null ? -1 : Long.parseLong(length);
            if (declared!=-1 && declared!=spec.size) throw new IOException("The update download size does not match.");
            long received=0, deadline=System.nanoTime()+15L*60*1000000000L, last=0;
            try (InputStream input=connection.getInputStream(); FileOutputStream output=new FileOutputStream(partial)) {
                byte[] bytes=new byte[65536]; int count;
                while ((count=input.read(bytes))!=-1) {
                    check(cancelled);
                    if (System.nanoTime()>deadline) throw new IOException("The update download timed out. Retry on a stable connection.");
                    received+=count;
                    if (received>spec.size || received>UpdatePolicy.MAX_BYTES) throw new IOException("The update download exceeds its declared size.");
                    output.write(bytes,0,count);
                    if (System.nanoTime()-last>200000000L) { progress.report(received,spec.size);last=System.nanoTime(); }
                }
                output.getFD().sync();
            }
            check(cancelled);
            if (received!=spec.size || !spec.sha256.equals(digest(partial))) throw new IOException("Update verification failed. The installed app was kept; retry the download.");
            check(cancelled);
            if (!partial.renameTo(target)) throw new IOException("The verified update could not be saved.");
            progress.report(received,spec.size);
            return target;
        } finally { connection.disconnect(); partial.delete(); }
    }
}
