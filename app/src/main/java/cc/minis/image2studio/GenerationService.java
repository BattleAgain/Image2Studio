package cc.minis.image2studio;

import android.app.*;
import android.content.*;
import android.os.*;
import android.net.wifi.WifiManager;

public class GenerationService extends Service{
 static final String CH="image2studio_generation", START="START", STOP="STOP", DONE="DONE", FAIL="FAIL";
 PowerManager.WakeLock wl; WifiManager.WifiLock wifi;
 public IBinder onBind(Intent i){return null;}
 public int onStartCommand(Intent it,int flags,int id){
  String a=it==null?START:it.getAction();
  if(STOP.equals(a)){releaseLocks();stopForeground(true);stopSelf();return START_NOT_STICKY;}
  if(DONE.equals(a)){notifyText("Image2Studio","生成完成");releaseLocks();stopForeground(false);stopSelf();return START_NOT_STICKY;}
  if(FAIL.equals(a)){notifyText("Image2Studio","生成失败，已自动重试后仍失败");releaseLocks();stopForeground(false);stopSelf();return START_NOT_STICKY;}
  acquireLocks();
  startForeground(1001,notification("Image2Studio 正在生成...","前台服务 + WakeLock + WiFi锁 + 失败自动重试已启用"));
  return START_STICKY;
 }
 void acquireLocks(){try{PowerManager pm=(PowerManager)getSystemService(POWER_SERVICE);if(wl==null)wl=pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Image2Studio:Service");wl.setReferenceCounted(false);if(!wl.isHeld())wl.acquire(10*60*1000L);}catch(Exception ignored){}try{WifiManager wm=(WifiManager)getApplicationContext().getSystemService(WIFI_SERVICE);if(wifi==null)wifi=wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF,"Image2Studio:ServiceWifi");wifi.setReferenceCounted(false);if(!wifi.isHeld())wifi.acquire();}catch(Exception ignored){}}
 void releaseLocks(){try{if(wifi!=null&&wifi.isHeld())wifi.release();}catch(Exception ignored){}try{if(wl!=null&&wl.isHeld())wl.release();}catch(Exception ignored){}}
 public void onDestroy(){releaseLocks();super.onDestroy();}
 void ensureChannel(){if(Build.VERSION.SDK_INT>=26){NotificationChannel c=new NotificationChannel(CH,"Image2Studio 生成任务",NotificationManager.IMPORTANCE_LOW);c.setDescription("生成图片时保持后台任务和网络连接");((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);}}
 Notification notification(String title,String text){ensureChannel();Intent open=new Intent(this,MainActivity.class);open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);PendingIntent pi=PendingIntent.getActivity(this,0,open,Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0);Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CH):new Notification.Builder(this);b.setContentTitle(title).setContentText(text).setSmallIcon(android.R.drawable.ic_menu_gallery).setContentIntent(pi).setOngoing(true).setShowWhen(true);return b.build();}
 void notifyText(String title,String text){ensureChannel();Intent open=new Intent(this,MainActivity.class);open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);PendingIntent pi=PendingIntent.getActivity(this,1,open,Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0);Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CH):new Notification.Builder(this);b.setContentTitle(title).setContentText(text).setSmallIcon(android.R.drawable.ic_menu_gallery).setContentIntent(pi).setAutoCancel(true);((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify((int)(System.currentTimeMillis()%100000),b.build());}
 public static void start(Context c){Intent i=new Intent(c,GenerationService.class);i.setAction(START);if(Build.VERSION.SDK_INT>=26)c.startForegroundService(i);else c.startService(i);} 
 public static void done(Context c){Intent i=new Intent(c,GenerationService.class);i.setAction(DONE);c.startService(i);} 
 public static void fail(Context c){Intent i=new Intent(c,GenerationService.class);i.setAction(FAIL);c.startService(i);} 
}
