# 🚀 دليل البدء السريع - Railway Deployment

## خطوات النشر السريعة

### 1️⃣ رفع المشروع إلى GitHub

```bash
cd Darigo/backend
git init
git add .
git commit -m "Ready for Railway deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/darigo-backend.git
git push -u origin main
```

### 2️⃣ النشر على Railway

1. اذهب إلى [railway.app](https://railway.app)
2. اضغط "New Project" → "Deploy from GitHub repo"
3. اختر مستودع `darigo-backend`
4. اذهب إلى **Settings → Variables** وأضف:

```
MONGODB_URI=mongodb+srv://Darabubkr:rvYx9GS726M1UFva@cluster0.1hvsgqh.mongodb.net/darigo-real-estate?retryWrites=true&w=majority
JWT_SECRET=change-this-to-a-very-strong-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
```

5. انتظر حتى يكتمل النشر (2-3 دقائق)

### 3️⃣ الحصول على الرابط

- اذهب إلى **Settings → Networking**
- اضغط "Generate Domain"
- ستظهر لك رابط مثل: `https://your-app.railway.app`

### 4️⃣ التحقق من النشر

افتح في المتصفح:
```
https://your-app.railway.app/api/health
```

يجب أن ترى:
```json
{
  "status": "success",
  "message": "الخادم يعمل بشكل صحيح",
  "database": "متصل"
}
```

### 5️⃣ إنشاء حساب مدير

في Railway:
1. اذهب إلى **Service → View Logs**
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

## ✅ تم! السيرفر جاهز الآن

**رابط API:** `https://your-app.railway.app/api`

**للتحديث:** استخدم رابط الـ API في تطبيقك بدلاً من `localhost:3001`

---

## 📚 للمزيد من التفاصيل

- `RAILWAY_DEPLOYMENT.md` - دليل شامل
- `DEPLOYMENT_CHECKLIST.md` - قائمة فحص
- `README.md` - معلومات عامة

