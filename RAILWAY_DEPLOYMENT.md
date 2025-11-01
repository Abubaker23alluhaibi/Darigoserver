# دليل النشر على Railway - Darigo Backend

## 📋 المتطلبات

- حساب على [Railway](https://railway.app)
- قاعدة بيانات MongoDB Atlas (أو يمكنك استخدام MongoDB من Railway)
- Git (للرفع من GitHub)

---

## 🚀 خطوات النشر

### 1. إعداد المشروع محلياً

```bash
cd Darigo/backend
npm install
```

### 2. إنشاء مستودع Git (إذا لم يكن موجوداً)

```bash
git init
git add .
git commit -m "Initial commit - Ready for Railway deployment"
```

### 3. رفع المشروع إلى GitHub

```bash
# إنشاء مستودع جديد على GitHub ثم:
git remote add origin https://github.com/YOUR_USERNAME/darigo-backend.git
git branch -M main
git push -u origin main
```

---

## 🎯 النشر على Railway

### الطريقة الأولى: من GitHub (موصى بها)

1. **سجل الدخول إلى Railway**
   - اذهب إلى [railway.app](https://railway.app)
   - سجل الدخول بحساب GitHub

2. **إنشاء مشروع جديد**
   - اضغط على "New Project"
   - اختر "Deploy from GitHub repo"
   - اختر المستودع `darigo-backend`

3. **إضافة متغيرات البيئة**
   - بعد النشر، اذهب إلى Settings → Variables
   - أضف المتغيرات التالية:

```
MONGODB_URI=mongodb+srv://Darabubkr:rvYx9GS726M1UFva@cluster0.1hvsgqh.mongodb.net/darigo-real-estate?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-key-change-this-in-production-min-32-chars
JWT_EXPIRES_IN=7d
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://yourdomain.com
```

**⚠️ مهم:** استبدل `JWT_SECRET` بمفتاح سري قوي (على الأقل 32 حرف)

4. **الحصول على رابط الخادم**
   - اذهب إلى Settings → Networking
   - اضغط "Generate Domain"
   - سيتم إنشاء رابط مثل: `https://your-app.railway.app`

### الطريقة الثانية: رفع مباشر

1. **إنشاء مشروع فارغ**
   - اضغط "New Project" → "Empty Project"

2. **ربط المجلد**
   - اضغط "Add Service" → "GitHub Repo"
   - اختر المستودع

3. **إعداد متغيرات البيئة** (نفس الخطوة 3 أعلاه)

---

## ✅ التحقق من النشر

بعد النشر، اختبر الخادم:

```bash
# فحص صحة الخادم
curl https://your-app.railway.app/api/health

# يجب أن يعود:
# {"status":"success","message":"الخادم يعمل بشكل صحيح",...}
```

---

## 🔧 إعدادات CORS

بعد النشر، يجب تحديث `CORS_ORIGIN` في Railway:

1. اذهب إلى Variables
2. أضف أو عدّل:
   ```
   CORS_ORIGIN=https://your-frontend-domain.com
   ```
3. أعد نشر الخدمة

**ملاحظة:** Railway domains (`*.railway.app`) مسموحة تلقائياً

---

## 📊 متغيرات البيئة المطلوبة

| المتغير | الوصف | مثال |
|---------|-------|------|
| `MONGODB_URI` | رابط قاعدة البيانات | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET` | مفتاح التشفير | `your-super-secret-key-32-chars-min` |
| `JWT_EXPIRES_IN` | مدة صلاحية Token | `7d` |
| `NODE_ENV` | بيئة التشغيل | `production` |
| `PORT` | منفذ الخادم | `3001` (Railway يضبطه تلقائياً) |
| `CORS_ORIGIN` | أصول مسموحة | `https://yourdomain.com` |

---

## 🔐 إنشاء حساب مدير بعد النشر

بعد النشر، يمكنك إنشاء حساب مدير عبر Railway Console:

1. اذهب إلى Service → "View Logs"
2. اضغط "Open Terminal"
3. شغل:
   ```bash
   node scripts/createAdmin.js
   ```

أو استخدم Railway CLI:
```bash
railway run node scripts/createAdmin.js
```

---

## 🐛 استكشاف الأخطاء

### الخطأ: "Cannot connect to MongoDB"
**الحل:**
- تأكد من أن `MONGODB_URI` صحيح
- تأكد من أن MongoDB Atlas يسمح بالاتصالات من جميع IPs (أو أضف IP Railway)

### الخطأ: "Port already in use"
**الحل:**
- Railway يضبط `PORT` تلقائياً، لا حاجة لتعديله

### الخطأ: "Module not found"
**الحل:**
- تأكد من وجود `package.json` في المجلد الجذر
- تأكد من أن جميع dependencies محددة

### الخادم لا يبدأ
**الحل:**
- تحقق من Logs في Railway
- تأكد من أن `Procfile` موجود وصحيح
- تأكد من أن `server.js` في المجلد الصحيح

---

## 📝 ملاحظات مهمة

1. **الأمان:**
   - لا تضع `.env` في Git
   - استخدم Railway Variables لجميع الأسرار
   - استخدم `JWT_SECRET` قوي (32+ حرف)

2. **الأداء:**
   - Railway يضبط المنفذ تلقائياً
   - استخدم MongoDB Atlas للحصول على أداء أفضل
   - راقب Logs بانتظام

3. **النسخ الاحتياطي:**
   - قم بعمل نسخة احتياطية من قاعدة البيانات بانتظام
   - احفظ متغيرات البيئة في مكان آمن

---

## 🔗 المسارات المتاحة

بعد النشر، الخادم يدعم:

- `GET /api/health` - فحص صحة الخادم
- `POST /api/auth/register` - تسجيل مستخدم جديد
- `POST /api/auth/login` - تسجيل الدخول
- `GET /api/properties` - الحصول على العقارات
- `POST /api/properties` - إضافة عقار جديد
- `GET /api/admin/properties` - عقارات الإدارة (يحتاج auth)

---

## 📞 الدعم

إذا واجهت أي مشكلة:
1. تحقق من Logs في Railway
2. تحقق من Variables
3. اختبر Health Check endpoint
4. تأكد من أن MongoDB متصل

---

**نشر سعيد! 🚀**

