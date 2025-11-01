# معلومات النشر - Darigo Backend

## ✅ تم النشر بنجاح!

**رابط السيرفر:** `https://web-production-2d009.up.railway.app`

**API Base URL:** `https://web-production-2d009.up.railway.app/api`

---

## 🔗 المسارات المتاحة

### الصحة والفحص
- `GET https://web-production-2d009.up.railway.app/api/health` - فحص صحة الخادم

### المصادقة
- `POST https://web-production-2d009.up.railway.app/api/auth/register` - تسجيل مستخدم جديد
- `POST https://web-production-2d009.up.railway.app/api/auth/login` - تسجيل الدخول

### العقارات
- `GET https://web-production-2d009.up.railway.app/api/properties` - الحصول على العقارات
- `POST https://web-production-2d009.up.railway.app/api/properties` - إضافة عقار جديد

---

## 🔧 إعدادات CORS

في Railway Variables، تأكد من إضافة:
```
CORS_ORIGIN=https://your-frontend-domain.com
```

أو إذا كنت تستخدم عدة domains:
```
CORS_ORIGIN=https://domain1.com,https://domain2.com
```

**ملاحظة:** Railway domains (`*.railway.app`) مسموحة تلقائياً

---

## 🔐 إنشاء حساب مدير

في Railway Terminal:
```bash
node scripts/createAdmin.js
```

أو باستخدام Railway CLI:
```bash
railway run node scripts/createAdmin.js
```

**البيانات الافتراضية:**
- البريد: `admin@darigo.com`
- كلمة المرور: `admin123`

⚠️ **غير كلمة المرور فوراً!**

---

## 📱 ربط الواجهة الأمامية

في ملفات الواجهة الأمامية، استبدل:
```javascript
// القديم
const API_BASE_URL = 'http://localhost:3001/api';

// الجديد
const API_BASE_URL = 'https://web-production-2d009.up.railway.app/api';
```

### الملفات التي يجب تحديثها:
- `Darigo/src/services/ApiService.js`
- `admin/js/admin.js` (في `dashboard.html`)

---

## ✅ التحقق من النشر

### 1. Health Check
افتح في المتصفح:
```
https://web-production-2d009.up.railway.app/api/health
```

يجب أن ترى:
```json
{
  "status": "success",
  "message": "الخادم يعمل بشكل صحيح",
  "database": "متصل"
}
```

### 2. اختبار تسجيل الدخول
```bash
curl -X POST https://web-production-2d009.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@darigo.com","password":"admin123"}'
```

---

## 📊 مراقبة الخادم

- **Logs:** في Railway → Service → View Logs
- **Metrics:** في Railway → Service → Metrics
- **Variables:** في Railway → Service → Variables

---

## 🔄 التحديثات

عند تحديث الكود:
1. ارفع التحديثات إلى GitHub
2. Railway سيعيد النشر تلقائياً
3. تحقق من Logs للتأكد من نجاح النشر

---

**تاريخ النشر:** 2025-11-01  
**الحالة:** ✅ نشط ومتاح

