# دليل النشر على Railway 🚀

دليل شامل لنشر باكند تطبيق داري go على Railway.

## ✅ المتطلبات الأساسية

### 1. الحساب والبنية
- ✅ حساب على [Railway.app](https://railway.app)
- ✅ حساب MongoDB Atlas (أو قاعدة بيانات MongoDB سحابية أخرى)
- ✅ حساب GitHub (مستحسن للنشر التلقائي)

### 2. ملفات المشروع
- ✅ `package.json` مع script `start`
- ✅ `Procfile` موجود
- ✅ `server.js` يسمع على `0.0.0.0` و `PORT`
- ✅ إعدادات CORS محدثة

## 📋 خطوات النشر

### الطريقة الأولى: النشر من GitHub (مستحسن)

#### 1. رفع الكود إلى GitHub
```bash
cd backend
git init
git add .
git commit -m "Initial commit - Ready for Railway"
git branch -M main
git remote add origin https://github.com/yourusername/darigo-backend.git
git push -u origin main
```

#### 2. إنشاء مشروع جديد على Railway
1. اذهب إلى [Railway Dashboard](https://railway.app/dashboard)
2. اضغط على **"New Project"**
3. اختر **"Deploy from GitHub repo"**
4. اختر المستودع `darigo-backend`
5. اختر الفرع `main`

#### 3. إعداد متغيرات البيئة
في صفحة المشروع، اذهب إلى **Variables** وأضف:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/darigo-real-estate
JWT_SECRET=your-very-secret-and-random-jwt-key-here
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://your-frontend-domain.com
```

**ملاحظات مهمة:**
- `PORT` - Railway يحدده تلقائياً، لكن يمكنك إضافته للاحتياط
- `JWT_SECRET` - استخدم مفتاحاً قوياً وعشوائياً (يمكنك استخدام: `openssl rand -base64 32`)
- `CORS_ORIGIN` - أضف domain الـ frontend الخاص بك (يمكن إضافة عدة domains مفصولة بفاصلة)
- Railway domains (`*.railway.app`) مسموحة تلقائياً

#### 4. تشغيل المشروع
- Railway سيبدأ البناء والنشر تلقائياً
- انتظر حتى ينتهي البناء
- سيظهر لك رابط المشروع (مثل: `https://your-app-name.railway.app`)

---

### الطريقة الثانية: النشر المباشر (Deploy Now)

1. اذهب إلى [Railway](https://railway.app)
2. اختر **"New Project"** → **"Deploy from GitHub repo"** أو **"Empty Project"**
3. إذا اخترت Empty Project:
   - ارفع محتويات مجلد `backend`
   - أو استخدم Railway CLI
4. أضف متغيرات البيئة كما في الطريقة الأولى

---

### الطريقة الثالثة: استخدام Railway CLI

```bash
# تثبيت Railway CLI
npm i -g @railway/cli

# تسجيل الدخول
railway login

# إنشاء مشروع جديد
railway init

# إضافة متغيرات البيئة
railway variables set MONGODB_URI="mongodb+srv://..."
railway variables set JWT_SECRET="your-secret-key"
railway variables set NODE_ENV="production"

# النشر
railway up
```

## 🔧 إعداد MongoDB Atlas

### 1. إنشاء قاعدة بيانات على Atlas
1. اذهب إلى [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. أنشئ حساباً أو سجل الدخول
3. أنشئ Cluster جديد
4. اذهب إلى **Database Access** وأنشئ مستخدماً
5. اذهب إلى **Network Access** وأضف IP: `0.0.0.0/0` (للسماح من أي مكان)
6. احصل على Connection String من **Connect**

### 2. تحديث MONGODB_URI
استبدل `<username>` و `<password>` في الـ connection string:
```
mongodb+srv://username:password@cluster-name.mongodb.net/darigo-real-estate?retryWrites=true&w=majority
```

## 🧪 اختبار النشر

### 1. اختبار Health Check
```bash
curl https://your-app-name.railway.app/api/health
```

يجب أن ترى:
```json
{
  "status": "success",
  "message": "الخادم يعمل بشكل صحيح",
  "timestamp": "...",
  "database": "متصل"
}
```

### 2. اختبار API Root
```bash
curl https://your-app-name.railway.app/
```

### 3. اختبار التسجيل
```bash
curl -X POST https://your-app-name.railway.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "07501234567",
    "password": "password123",
    "confirmPassword": "password123"
  }'
```

## ⚙️ الإعدادات الإضافية

### Custom Domain
1. في صفحة المشروع على Railway
2. اذهب إلى **Settings** → **Domains**
3. أضف domain مخصصك
4. اتبع التعليمات لإعداد DNS

### Environment Variables المهمة

| المتغير | الوصف | مثال |
|---------|-------|------|
| `MONGODB_URI` | رابط قاعدة البيانات (مطلوب) | `mongodb+srv://...` |
| `JWT_SECRET` | مفتاح التشفير (مطلوب) | مفتاح عشوائي قوي |
| `NODE_ENV` | بيئة التشغيل | `production` |
| `PORT` | منفذ الخادم | `3001` (اختياري - Railway يحدده) |
| `CORS_ORIGIN` | أصول مسموحة لـ CORS | `https://yourdomain.com` |
| `JWT_EXPIRES_IN` | مدة صلاحية JWT | `7d` |

### Monitoring والـ Logs
- Railway يوفر logs مباشرة في Dashboard
- يمكنك رؤية الأخطاء والأداء في الوقت الفعلي

## 🔒 الأمان

### نصائح مهمة:
1. **JWT_SECRET**: استخدم مفتاحاً قوياً وطويلاً (32+ حرف)
2. **MongoDB**: لا تشارك credentials مع أحد
3. **CORS**: حدّث `CORS_ORIGIN` فقط بالـ domains المسموحة
4. **Environment Variables**: لا ترفع ملف `.env` إلى GitHub

## 🐛 حل المشاكل الشائعة

### المشكلة: الخادم لا يبدأ
**الحل:**
- تأكد من أن `package.json` يحتوي على `"start": "node server.js"`
- تحقق من الـ logs في Railway Dashboard
- تأكد من صحة `MONGODB_URI`

### المشكلة: خطأ CORS
**الحل:**
- أضف frontend domain في `CORS_ORIGIN`
- أو اتركه فارغاً للسماح بجميع Railway domains

### المشكلة: خطأ في الاتصال بقاعدة البيانات
**الحل:**
- تأكد من أن IP المسموح في MongoDB Atlas يشمل Railway IPs
- أو استخدم `0.0.0.0/0` للسماح من أي مكان
- تحقق من صحة `MONGODB_URI`

### المشكلة: 502 Bad Gateway
**الحل:**
- تأكد من أن الخادم يسمع على `0.0.0.0` وليس `localhost`
- تحقق من أن `PORT` يتم قراءته من متغيرات البيئة

## 📊 الملفات المهمة

```
backend/
├── server.js              # ملف الخادم الرئيسي
├── package.json           # التبعيات والإعدادات
├── Procfile              # إعدادات Railway
├── railway.json          # إعدادات إضافية (اختياري)
├── env.example           # مثال لمتغيرات البيئة
└── RAILWAY_DEPLOYMENT_GUIDE.md  # هذا الملف
```

## ✅ قائمة التحقق النهائية

قبل النشر، تأكد من:
- [ ] `MONGODB_URI` صحيح ويعمل
- [ ] `JWT_SECRET` قوي وآمن
- [ ] `CORS_ORIGIN` محدّث (إن لزم)
- [ ] `NODE_ENV=production`
- [ ] الكود موجود على GitHub (إن كنت تستخدم النشر التلقائي)
- [ ] جميع التبعيات موجودة في `package.json`
- [ ] `Procfile` موجود وصحيح

## 🎉 بعد النشر

1. اختبر جميع الـ endpoints
2. راجع الـ logs للتأكد من عدم وجود أخطاء
3. حدث الـ frontend بالـ API URL الجديد
4. راقب الأداء والاستخدام

## 📞 الدعم

إذا واجهت مشاكل:
1. راجع الـ logs في Railway Dashboard
2. تحقق من Railway [Documentation](https://docs.railway.app)
3. تأكد من أن جميع متغيرات البيئة صحيحة

---

**تم! 🎉** باكندك جاهز للنشر على Railway!

