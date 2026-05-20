package cc.minis.image2studio;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.res.AssetFileDescriptor;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;

public class ImageShareProvider extends ContentProvider {
    public boolean onCreate() { return true; }
    public String getType(Uri uri) { return uri.getLastPathSegment()!=null&&uri.getLastPathSegment().endsWith(".log") ? "text/plain" : "image/png"; }
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) { return null; }
    public Uri insert(Uri uri, ContentValues values) { return null; }
    public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }

    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || name.contains("/") || name.contains("..")) throw new FileNotFoundException("bad name");
        File f;
        if (uri.getPath() != null && uri.getPath().startsWith("/logs/")) f = new File(getContext().getFilesDir(), "error_logs/" + name);
        else f = new File(getContext().getFilesDir(), "images/" + name);
        int flags = mode != null && mode.indexOf('w') >= 0 ? (ParcelFileDescriptor.MODE_READ_WRITE | ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_TRUNCATE) : ParcelFileDescriptor.MODE_READ_ONLY;
        return ParcelFileDescriptor.open(f, flags);
    }
}
