package cc.minis.image2studio;

import android.app.*;
import android.content.*;
import android.os.*;

public class GenerationService extends Service{
 static final String CH="image2studio_generation", START="START", STOP="STOP", DONE="DONE", FAIL="FAIL";
 public IBinder onBind(Intent i){return null;}
 public int onStartCommand(Intent it,int flags,int id){
  String a=it==null?START:it.getAction();
  if(STOP.equals(a)){stopForeground(true);stopSelf();return START_NOT_STICKY;}
  if(DONE.equals(a)){notifyText("Image2Studio","生成完成");stopForeground(false);stopSelf();return START_NOT_STICKY;}
  if(FAIL.equals(a)){notifyText("Image2Studio","生成失败");stopForeground(false);stopSelf();return START_NOT_STICKY;}
  startForeground(1001,notification("Image2Studio 正在生成...","请勿关闭应用，后台会继续保持任务"));
  return START_STICKY;
 }
 void ensureChannel(){if(Build.VERSION.SDK_INT>=26){NotificationChannel c=new NotificationChannel(CH,"Image2Studio 生成任务",NotificationManager.IMPORTANCE_LOW);c.setDescription("生成图片时保持后台任务");((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);}}
 Notification notification(String title,String text){ensureChannel();Intent open=new Intent(this,MainActivity.class);open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);PendingIntent pi=PendingIntent.getActivity(this,0,open,Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0);Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CH):new Notification.Builder(this);b.setContentTitle(title).setContentText(text).setSmallIcon(android.R.drawable.ic_menu_gallery).setContentIntent(pi).setOngoing(true);return b.build();}
 void notifyText(String title,String text){ensureChannel();Intent open=new Intent(this,MainActivity.class);open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);PendingIntent pi=PendingIntent.getActivity(this,1,open,Build.VERSION.SDK_INT>=23?PendingIntent.FLAG_IMMUTABLE:0);Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CH):new Notification.Builder(this);b.setContentTitle(title).setContentText(text).setSmallIcon(android.R.drawable.ic_menu_gallery).setContentIntent(pi).setAutoCancel(true);((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).notify((int)(System.currentTimeMillis()%100000),b.build());}
 public static void start(Context c){Intent i=new Intent(c,GenerationService.class);i.setAction(START);if(Build.VERSION.SDK_INT>=26)c.startForegroundService(i);else c.startService(i);} 
 public static void done(Context c){Intent i=new Intent(c,GenerationService.class);i.setAction(DONE);c.startService(i);} 
 public static void fail(Context c){Intent i=new Intent(c,GenerationService.class);i.setAction(FAIL);c.startService(i);} 
}
