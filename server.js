import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'mongo-sanitize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// تحميل متغيرات البيئة
dotenv.config();

// ============================================
// LOGGING HELPER (للإنتاج)
// ============================================
const isProduction = process.env.NODE_ENV === 'production';
const logger = {
  log: (...args) => {
    if (!isProduction) console.log(...args);
  },
  error: (...args) => {
    console.error(...args); // الأخطاء دائماً تظهر
  },
  warn: (...args) => {
    if (!isProduction) console.warn(...args);
  }
};

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// DATABASE CONNECTION
// ============================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/darigo-real-estate';

const mongooseOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000, // زيادة الوقت لانتظار الاتصال
  socketTimeoutMS: 45000,
  bufferCommands: true, // تفعيل buffer للسماح بانتظار الاتصال
  retryWrites: true,
  w: 'majority'
};

const isAtlas = MONGODB_URI.includes('mongodb+srv');

if (isAtlas) {
  mongooseOptions.ssl = true;
  mongooseOptions.directConnection = false;
} else {
  mongooseOptions.ssl = false;
  mongooseOptions.directConnection = true;
}

const connectDatabase = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      logger.log('✅ قاعدة البيانات متصلة بالفعل');
      return true;
    }

    logger.log('🚀 بدء الاتصال بقاعدة البيانات...');
    logger.log(`🔗 نوع الاتصال: ${isAtlas ? 'سحابي (Atlas)' : 'محلي'}`);
    
    await mongoose.connect(MONGODB_URI, mongooseOptions);
    
    logger.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');
    logger.log(`📊 قاعدة البيانات: ${mongoose.connection.name}`);
    
    return true;
  } catch (error) {
    logger.error('❌ خطأ في الاتصال بقاعدة البيانات:', error.message);
    setTimeout(() => {
      logger.log('🔄 محاولة إعادة الاتصال بقاعدة البيانات...');
      connectDatabase();
    }, 5000);
    return false;
  }
};

mongoose.connection.on('connected', () => {
  logger.log('🟢 حالة الاتصال: متصل');
});

mongoose.connection.on('error', (error) => {
  logger.error('🔴 خطأ في الاتصال:', error.message);
});

mongoose.connection.on('disconnected', () => {
  logger.log('🟡 حالة الاتصال: منقطع');
});

// ============================================
// MONGOOSE MODELS
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'الاسم مطلوب'],
    trim: true,
    minlength: [2, 'الاسم يجب أن يكون على الأقل حرفين'],
    maxlength: [100, 'الاسم لا يمكن أن يتجاوز 100 حرف']
  },
  email: {
    type: String,
    required: [true, 'البريد الإلكتروني مطلوب'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'البريد الإلكتروني غير صحيح']
  },
  phone: {
    type: String,
    required: [true, 'رقم الهاتف مطلوب'],
    trim: true,
    match: [/^(\+964|0)?[0-9]{10,11}$/, 'رقم الهاتف غير صحيح']
  },
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل']
  },
  userType: {
    type: String,
    enum: ['individual', 'agency', 'admin'],
    default: 'individual',
    required: true
  },
  agencyInfo: {
    agencyName: { type: String, trim: true, maxlength: [200, 'اسم المكتب لا يمكن أن يتجاوز 200 حرف'] },
    licenseNumber: { type: String, trim: true, maxlength: [50, 'رقم الترخيص لا يمكن أن يتجاوز 50 حرف'] },
    licenseImage: { type: String, trim: true },
    description: { type: String, trim: true, maxlength: [1000, 'وصف المكتب لا يمكن أن يتجاوز 1000 حرف'] }
  },
  profileImage: { type: String, trim: true },
  location: {
    city: { type: String, trim: true, maxlength: [50, 'اسم المدينة لا يمكن أن يتجاوز 50 حرف'] },
    district: { type: String, trim: true, maxlength: [50, 'اسم القضاء لا يمكن أن يتجاوز 50 حرف'] },
    neighborhood: { type: String, trim: true, maxlength: [50, 'اسم الحي لا يمكن أن يتجاوز 50 حرف'] }
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  lastLogin: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// email لديه unique: true والذي ينشئ index تلقائياً، لا حاجة لإضافة index مرة أخرى
userSchema.index({ phone: 1 });
userSchema.index({ userType: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Property Schema
const propertySchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
    minlength: [3, 'عنوان العقار يجب أن يكون على الأقل 3 أحرف'],
    maxlength: [200, 'عنوان العقار لا يمكن أن يتجاوز 200 حرف']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'وصف العقار لا يمكن أن يتجاوز 2000 حرف']
  },
  type: {
    type: String,
    enum: ['sale', 'rent', 'dailyRent']
  },
  category: {
    type: String,
    enum: ['house', 'apartment', 'villa', 'land', 'farm']
  },
  price: {
    type: Number,
    min: [0, 'السعر لا يمكن أن يكون سالباً']
  },
  area: {
    type: Number,
    min: [0, 'المساحة لا يمكن أن تكون سالبة']
  },
  rooms: { type: Number, default: 0, min: [0, 'عدد الغرف لا يمكن أن يكون سالباً'] },
  bathrooms: { type: Number, default: 0, min: [0, 'عدد الحمامات لا يمكن أن يكون سالباً'] },
  location: {
    city: { type: String, trim: true, maxlength: [50, 'اسم المدينة لا يمكن أن يتجاوز 50 حرف'] },
    district: { type: String, trim: true, maxlength: [50, 'اسم القضاء لا يمكن أن يتجاوز 50 حرف'] },
    neighborhood: { type: String, trim: true, maxlength: [50, 'اسم الحي لا يمكن أن يتجاوز 50 حرف'] },
    address: { type: String, trim: true, maxlength: [500, 'العنوان لا يمكن أن يتجاوز 500 حرف'] },
    coordinates: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 }
    }
  },
  features: [{ type: String, trim: true }],
  additionalFeatures: { type: String, trim: true, maxlength: [1000, 'المميزات الإضافية لا يمكن أن تتجاوز 1000 حرف'] },
  images: [{
    url: { type: String, trim: true },
    caption: { type: String, trim: true, maxlength: [200, 'تعليق الصورة لا يمكن أن يتجاوز 200 حرف'] },
    isMain: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now }
  }],
  videos: [{
    url: { type: String, trim: true },
    caption: { type: String, trim: true, maxlength: [200, 'تعليق الفيديو لا يمكن أن يتجاوز 200 حرف'] },
    duration: { type: Number, min: 0 },
    uploadedAt: { type: Date, default: Date.now }
  }],
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'مالك العقار مطلوب']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'sold', 'rented', 'inactive'],
    default: 'pending'
  },
  featured: { type: Boolean, default: false },
  stats: {
    views: { type: Number, default: 0 },
    contacts: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
    shares: { type: Number, default: 0 }
  },
  dailyRentInfo: {
    minDays: { type: Number, min: 1, default: 1 },
    maxDays: { type: Number, min: 1, default: 30 },
    availableDays: [{
      date: { type: Date, required: true },
      isAvailable: { type: Boolean, default: true },
      bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    rules: { type: String, trim: true, maxlength: [1000, 'قواعد الإيجار لا يمكن أن تتجاوز 1000 حرف'] }
  },
  farmInfo: {
    hasWater: { type: Boolean, default: false },
    hasElectricity: { type: Boolean, default: false },
    hasParking: { type: Boolean, default: false },
    hasRestroom: { type: Boolean, default: false },
    hasKitchen: { type: Boolean, default: false },
    hasBBQ: { type: Boolean, default: false },
    hasPlayground: { type: Boolean, default: false },
    hasPool: { type: Boolean, default: false },
    maxCapacity: { type: Number, min: 1, default: 10 }
  },
  reviews: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: [500, 'التعليق لا يمكن أن يتجاوز 500 حرف'] },
    createdAt: { type: Date, default: Date.now }
  }],
  averageRating: { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 },
  expiryDate: { type: Date },
  soldDate: { type: Date },
  soldTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags: [{ type: String, trim: true, lowercase: true }],
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

propertySchema.index({ title: 'text', description: 'text' });
propertySchema.index({ type: 1 });
propertySchema.index({ category: 1 });
propertySchema.index({ 'location.city': 1 });
propertySchema.index({ 'location.district': 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ area: 1 });
propertySchema.index({ owner: 1 });
propertySchema.index({ status: 1 });
propertySchema.index({ featured: 1 });
propertySchema.index({ createdAt: -1 });

const Property = mongoose.models.Property || mongoose.model('Property', propertySchema);

// ============================================
// MIDDLEWARE
// ============================================

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    // التحقق من وجود Authorization header
    if (!authHeader) {
      return res.status(401).json({
        status: 'error',
        message: 'الرمز المميز مطلوب للمصادقة'
      });
    }

    // التحقق من التنسيق (Bearer token)
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        status: 'error',
        message: 'تنسيق الرمز المميز غير صحيح'
      });
    }

    const token = parts[1];

    // التحقق من طول الرمز (حماية أساسية)
    if (token.length < 10 || token.length > 500) {
      return res.status(401).json({
        status: 'error',
        message: 'الرمز المميز غير صالح'
      });
    }

    // استخدام JWT_SECRET من environment variable
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'darigo-super-secret-key-change-this-in-production') {
      logger.error('⚠️ JWT_SECRET غير معرّف بشكل صحيح!');
      if (isProduction) {
        return res.status(500).json({
          status: 'error',
          message: 'خطأ في إعدادات الخادم'
        });
      }
    }

    const decoded = jwt.verify(token, jwtSecret || 'darigo-super-secret-key-change-this-in-production');
    
    // التحقق من وجود userId في الرمز
    if (!decoded.userId) {
      return res.status(401).json({
        status: 'error',
        message: 'الرمز المميز غير صالح'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'المستخدم غير موجود'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'الحساب غير نشط. يرجى الاتصال بالدعم'
      });
    }

    req.user = {
      userId: user._id,
      email: user.email,
      userType: user.userType
    };

    next();
  } catch (error) {
    logger.error('خطأ في المصادقة:', error);
    
    // رسائل خطأ محددة
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'انتهت صلاحية الرمز المميز. يرجى تسجيل الدخول مرة أخرى'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'error',
        message: 'الرمز المميز غير صالح'
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'خطأ في التحقق من الرمز المميز'
    });
  }
};

// Validation Middleware
const validateRegistration = (req, res, next) => {
  const { name, email, phone, password, confirmPassword, userType, agencyName, licenseNumber } = req.body;

  // التحقق من الحقول المطلوبة
  if (!name || !email || !phone || !password || !confirmPassword) {
    return res.status(400).json({
      status: 'error',
      message: 'جميع الحقول مطلوبة'
    });
  }

  // تنظيف وحماية من XSS
  const sanitizeInput = (str) => {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/<[^>]*>/g, ''); // إزالة HTML tags
  };

  const sanitizedName = sanitizeInput(name);
  if (sanitizedName.length < 2 || sanitizedName.length > 100) {
    return res.status(400).json({
      status: 'error',
      message: 'الاسم يجب أن يكون بين 2 و 100 حرف'
    });
  }

  // التحقق من البريد الإلكتروني
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const sanitizedEmail = email.toLowerCase().trim();
  if (!emailRegex.test(sanitizedEmail) || sanitizedEmail.length > 255) {
    return res.status(400).json({
      status: 'error',
      message: 'البريد الإلكتروني غير صحيح'
    });
  }

  // التحقق من رقم الهاتف العراقي
  const phoneRegex = /^(\+964|00964|0)?[7][0-9]{9}$/;
  const sanitizedPhone = phone.replace(/\s+/g, ''); // إزالة المسافات
  if (!phoneRegex.test(sanitizedPhone)) {
    return res.status(400).json({
      status: 'error',
      message: 'رقم الهاتف العراقي غير صحيح (يجب أن يبدأ بـ 07 أو +964)'
    });
  }

  // التحقق من كلمة المرور
  if (password.length < 8) {
    return res.status(400).json({
      status: 'error',
      message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'
    });
  }

  // التحقق من قوة كلمة المرور
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password) && password.length < 8) {
    return res.status(400).json({
      status: 'error',
      message: 'كلمة المرور يجب أن تحتوي على حروف كبيرة وصغيرة وأرقام (8 أحرف على الأقل)'
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      status: 'error',
      message: 'كلمة المرور غير متطابقة'
    });
  }

  // التحقق من نوع المستخدم
  if (userType && !['individual', 'agency'].includes(userType)) {
    return res.status(400).json({
      status: 'error',
      message: 'نوع المستخدم غير صحيح'
    });
  }

  // التحقق من معلومات المكتب
  if (userType === 'agency') {
    const sanitizedAgencyName = sanitizeInput(agencyName || '');
    const sanitizedLicenseNumber = sanitizeInput(licenseNumber || '');
    
    if (!sanitizedAgencyName || sanitizedAgencyName.length < 3 || sanitizedAgencyName.length > 200) {
      return res.status(400).json({
        status: 'error',
        message: 'اسم المكتب يجب أن يكون بين 3 و 200 حرف'
      });
    }

    if (!sanitizedLicenseNumber || sanitizedLicenseNumber.length < 5 || sanitizedLicenseNumber.length > 50) {
      return res.status(400).json({
        status: 'error',
        message: 'رقم الترخيص يجب أن يكون بين 5 و 50 حرف'
      });
    }
  }

  // تحديث البيانات بعد التنظيف
  req.body.name = sanitizedName;
  req.body.email = sanitizedEmail;
  req.body.phone = sanitizedPhone;
  if (userType === 'agency') {
    req.body.agencyName = sanitizeInput(agencyName);
    req.body.licenseNumber = sanitizeInput(licenseNumber);
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      status: 'error',
      message: 'البريد الإلكتروني غير صحيح'
    });
  }

  next();
};

const validateProperty = (req, res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'لا توجد بيانات للتحقق منها'
    });
  }

  const { title, type, category, price, area, location } = req.body;

  if (title && (title.length < 3 || title.length > 200)) {
    return res.status(400).json({
      status: 'error',
      message: 'العنوان يجب أن يكون بين 3 و 200 حرف'
    });
  }

  if (type && !['sale', 'rent', 'dailyRent'].includes(type)) {
    return res.status(400).json({
      status: 'error',
      message: 'نوع العقار غير صحيح'
    });
  }

  if (category && !['house', 'apartment', 'villa', 'land', 'farm'].includes(category)) {
    return res.status(400).json({
      status: 'error',
      message: 'فئة العقار غير صحيحة'
    });
  }

  if (price !== undefined && price < 0) {
    return res.status(400).json({
      status: 'error',
      message: 'السعر يجب أن يكون أكبر من أو يساوي صفر'
    });
  }

  if (area !== undefined && area < 0) {
    return res.status(400).json({
      status: 'error',
      message: 'المساحة يجب أن تكون أكبر من أو تساوي صفر'
    });
  }

  if (location && typeof location === 'object') {
    if (!location.city && !location.district && !location.address) {
      return res.status(400).json({
        status: 'error',
        message: 'إذا تم إدخال الموقع، يجب إدخال المدينة أو الحي أو العنوان على الأقل'
      });
    }
  }

  next();
};

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.userType !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'ليس لديك صلاحية إدارية'
      });
    }
    req.adminUser = user;
    next();
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'خطأ في التحقق من الصلاحيات'
    });
  }
};

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Trust Proxy - مهم جداً للـ Cloud Providers (Railway, Heroku, etc.)
// يسمح لـ Express بالثقة في X-Forwarded-For header من reverse proxy
app.set('trust proxy', true);

// Helmet - Security Headers
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false, // تعطيل في التطوير لتسهيل التطوير
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate Limiting - حماية من الهجمات
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: isProduction ? 100 : 1000, // 100 طلب في الإنتاج، 1000 في التطوير
  message: {
    status: 'error',
    message: 'تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة مرة أخرى لاحقاً.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiting للـ Auth endpoints (أكثر حماية)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5, // 5 محاولات فقط
  message: {
    status: 'error',
    message: 'تم تجاوز الحد المسموح من محاولات تسجيل الدخول. يرجى المحاولة بعد 15 دقيقة.'
  },
  skipSuccessfulRequests: true, // لا نحسب الطلبات الناجحة
});

app.use('/api/', limiter); // تطبيق على جميع API endpoints
app.use('/api/auth/', authLimiter); // حماية إضافية لـ Auth

// Sanitize MongoDB - حماية من NoSQL Injection
app.use((req, res, next) => {
  if (req.body) {
    req.body = mongoSanitize(req.body);
  }
  if (req.query) {
    req.query = mongoSanitize(req.query);
  }
  if (req.params) {
    req.params = mongoSanitize(req.params);
  }
  next();
});

// ============================================
// APP MIDDLEWARE
// ============================================

app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// JSON & URL Encoded Parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // حماية من JSON Bombs
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({
        status: 'error',
        message: 'JSON غير صحيح'
      });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors({
  origin: function (origin, callback) {
    // في وضع التطوير، السماح بجميع الأصول
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      return callback(null, true);
    }
    
    // الحصول على الأصول المسموحة من متغيرات البيئة أو القائمة الافتراضية
    const corsOrigin = process.env.CORS_ORIGIN;
    let allowedOrigins = [];
    
    // إذا كان CORS_ORIGIN معرّف، استخدمه
    if (corsOrigin) {
      // دعم عدة أصول مفصولة بفاصلة
      allowedOrigins = corsOrigin.split(',').map(origin => origin.trim());
    } else if (isProduction) {
      // في الإنتاج، يجب تعيين CORS_ORIGIN
      allowedOrigins = [];
      logger.warn('⚠️ CORS_ORIGIN غير معرّف في الإنتاج');
    } else {
      // القائمة الافتراضية للتطوير فقط
      allowedOrigins = [
        'http://localhost:3000', 
        'http://localhost:19006', 
        'http://localhost:3001',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3000'
      ];
    }
    
    // السماح بطلبات بدون origin (لـ Railway health checks فقط في الإنتاج)
    if (!origin || origin === 'null') {
      if (isProduction) {
        // في الإنتاج، نسمح فقط لـ Railway health checks
        return callback(null, true);
      }
      return callback(null, true);
    }
    
    // التحقق من الأصول المسموحة
    // السماح بأي domain من Railway (.railway.app)
    const isRailwayDomain = origin.includes('.railway.app');
    const isAllowed = allowedOrigins.some(allowed => {
      // دعم wildcard patterns
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return origin === allowed;
    });
    
    // السماح بـ localhost فقط في التطوير
    const isLocalhost = !isProduction && (
      origin.startsWith('http://localhost:') || 
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.0.') ||
      origin.startsWith('http://172.')
    );
    
    if (isAllowed || isRailwayDomain || isLocalhost) {
      callback(null, true);
    } else {
      logger.warn(`⚠️ CORS: Origin غير مسموح: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================================
// ROUTES
// ============================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'الخادم يعمل بشكل صحيح',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'متصل' : 'غير متصل'
  });
});

// Root Route
app.get('/', (req, res) => {
  res.json({
    message: 'مرحباً بك في API تطبيق داري go العقاري',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      properties: '/api/properties',
      users: '/api/users',
      health: '/api/health'
    }
  });
});

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/register', validateRegistration, async (req, res) => {
  try {
    const { name, email, phone, password, userType, agencyName, licenseNumber } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'المستخدم موجود بالفعل'
      });
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userData = {
      name,
      email,
      phone,
      password: hashedPassword,
      userType: userType || 'individual',
      isActive: true,
      createdAt: new Date(),
      lastLogin: null
    };

    if (userType === 'agency') {
      userData.agencyInfo = {
        agencyName,
        licenseNumber
      };
    }

    const user = new User(userData);
    const savedUser = await user.save();

    const token = jwt.sign(
      { 
        userId: savedUser._id, 
        email: savedUser.email,
        userType: savedUser.userType 
      },
      process.env.JWT_SECRET || 'darigo-super-secret-key-change-this-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const userResponse = savedUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      status: 'success',
      message: 'تم إنشاء الحساب بنجاح',
      data: {
        user: userResponse,
        token: token
      }
    });

  } catch (error) {
    logger.error('خطأ في التسجيل:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في إنشاء الحساب',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.post('/api/auth/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'الحساب غير نشط'
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        userType: user.userType 
      },
      process.env.JWT_SECRET || 'darigo-super-secret-key-change-this-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      status: 'success',
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        user: userResponse,
        token: token
      }
    });

  } catch (error) {
    logger.error('خطأ في تسجيل الدخول:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تسجيل الدخول',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.post('/api/auth/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'الرمز المميز مطلوب'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'darigo-super-secret-key-change-this-in-production');
    
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'error',
        message: 'الرمز المميز غير صالح'
      });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      status: 'success',
      message: 'الرمز المميز صالح',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    logger.error('خطأ في التحقق من الرمز:', error);
    res.status(401).json({
      status: 'error',
      message: 'الرمز المميز غير صالح'
    });
  }
});

app.put('/api/auth/profile', async (req, res) => {
  try {
    const { token, ...updateData } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'الرمز المميز مطلوب'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'darigo-super-secret-key-change-this-in-production');
    
    const user = await User.findByIdAndUpdate(
      decoded.userId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'المستخدم غير موجود'
      });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      status: 'success',
      message: 'تم تحديث الملف الشخصي بنجاح',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    logger.error('خطأ في تحديث الملف الشخصي:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديث الملف الشخصي',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

// ============================================
// PROPERTY ROUTES
// ============================================

app.get('/api/properties', async (req, res) => {
  try {
    const {
      type,
      category,
      city,
      district,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
      rooms,
      bathrooms,
      features,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    const query = {
      status: 'approved',
      isPublished: true
    };

    if (type) query.type = type;
    if (category) query.category = category;
    if (city) query['location.city'] = city;
    if (district) query['location.district'] = district;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }

    if (minArea || maxArea) {
      query.area = {};
      if (minArea) query.area.$gte = parseInt(minArea);
      if (maxArea) query.area.$lte = parseInt(maxArea);
    }

    if (rooms !== undefined) query.rooms = parseInt(rooms);
    if (bathrooms !== undefined) query.bathrooms = parseInt(bathrooms);

    if (features) {
      const featuresArray = features.split(',');
      query.features = { $in: featuresArray };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const properties = await Property.find(query)
      .populate('owner', 'name email phone profileImage userType agencyInfo')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Property.countDocuments(query);

    res.json({
      status: 'success',
      message: 'تم الحصول على العقارات بنجاح',
      data: {
        properties,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + properties.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    logger.error('خطأ في الحصول على العقارات:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في الحصول على العقارات',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findById(id)
      .populate('owner', 'name email phone profileImage userType agencyInfo');

    if (!property) {
      return res.status(404).json({
        status: 'error',
        message: 'العقار غير موجود'
      });
    }

    res.json({
      status: 'success',
      message: 'تم الحصول على العقار بنجاح',
      data: {
        property
      }
    });

  } catch (error) {
    logger.error('خطأ في الحصول على العقار:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في الحصول على العقار',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.post('/api/properties', authenticateToken, validateProperty, async (req, res) => {
  try {
    // إزالة status و isPublished من البيانات المرسلة لتجنب التلاعب
    const { status, isPublished, publishedAt, ...cleanBody } = req.body;
    
    const propertyData = {
      ...cleanBody,
      owner: req.user.userId,
      status: 'pending', // العقار الجديد يكون في انتظار المراجعة (إجباري)
      isPublished: false, // لن يتم نشره حتى تتم الموافقة عليه (إجباري)
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const property = new Property(propertyData);
    const savedProperty = await property.save();

    await savedProperty.populate('owner', 'name email phone profileImage userType agencyInfo');

    res.status(201).json({
      status: 'success',
      message: 'تم إضافة العقار بنجاح. سيتم نشره بعد موافقة الإدارة',
      data: {
        property: savedProperty
      }
    });

  } catch (error) {
    logger.error('خطأ في إضافة العقار:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في إضافة العقار',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف',
      details: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : undefined
    });
  }
});

app.put('/api/properties/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // إزالة الحقول المحمية من التحديث (يمكن للأدمن فقط تغييرها)
    const { status, isPublished, publishedAt, owner, ...cleanBody } = req.body;
    
    const updateData = {
      ...cleanBody,
      updatedAt: new Date()
    };

    const property = await Property.findOneAndUpdate(
      { _id: id, owner: req.user.userId },
      updateData,
      { new: true, runValidators: true }
    ).populate('owner', 'name email phone profileImage userType agencyInfo');

    if (!property) {
      return res.status(404).json({
        status: 'error',
        message: 'العقار غير موجود أو ليس لديك صلاحية لتعديله'
      });
    }

    res.json({
      status: 'success',
      message: 'تم تحديث العقار بنجاح',
      data: {
        property
      }
    });

  } catch (error) {
    logger.error('خطأ في تحديث العقار:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديث العقار',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.delete('/api/properties/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findOneAndDelete({
      _id: id,
      owner: req.user.userId
    });

    if (!property) {
      return res.status(404).json({
        status: 'error',
        message: 'العقار غير موجود أو ليس لديك صلاحية لحذفه'
      });
    }

    res.json({
      status: 'success',
      message: 'تم حذف العقار بنجاح'
    });

  } catch (error) {
    logger.error('خطأ في حذف العقار:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في حذف العقار',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.get('/api/properties/user/my-properties', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const properties = await Property.find({ owner: req.user.userId })
      .populate('owner', 'name email phone profileImage userType agencyInfo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Property.countDocuments({ owner: req.user.userId });

    res.json({
      status: 'success',
      message: 'تم الحصول على عقاراتك بنجاح',
      data: {
        properties,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + properties.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    logger.error('خطأ في الحصول على عقارات المستخدم:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في الحصول على عقاراتك',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

// ============================================
// USER ROUTES
// ============================================

app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'المستخدم غير موجود'
      });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      status: 'success',
      message: 'تم الحصول على الملف الشخصي بنجاح',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    logger.error('خطأ في الحصول على الملف الشخصي:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في الحصول على الملف الشخصي',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { password, ...updateData } = req.body;

    if (password) {
      const saltRounds = 12;
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'المستخدم غير موجود'
      });
    }

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      status: 'success',
      message: 'تم تحديث الملف الشخصي بنجاح',
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    logger.error('خطأ في تحديث الملف الشخصي:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديث الملف الشخصي',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.delete('/api/users/account', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user.userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'المستخدم غير موجود'
      });
    }

    res.json({
      status: 'success',
      message: 'تم حذف الحساب بنجاح'
    });

  } catch (error) {
    logger.error('خطأ في حذف الحساب:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في حذف الحساب',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.get('/api/users/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const totalProperties = await Property.countDocuments({ owner: userId });
    const publishedProperties = await Property.countDocuments({ 
      owner: userId, 
      status: 'approved',
      isPublished: true 
    });
    const pendingProperties = await Property.countDocuments({ 
      owner: userId, 
      status: 'pending' 
    });
    const rejectedProperties = await Property.countDocuments({ 
      owner: userId, 
      status: 'rejected' 
    });

    const totalViewsAgg = await Property.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, totalViews: { $sum: '$stats.views' } } }
    ]);

    res.json({
      status: 'success',
      message: 'تم الحصول على الإحصائيات بنجاح',
      data: {
        properties: {
          total: totalProperties,
          published: publishedProperties,
          pending: pendingProperties,
          rejected: rejectedProperties
        },
        views: { total: totalViewsAgg[0]?.totalViews || 0 }
      }
    });

  } catch (error) {
    logger.error('خطأ في الحصول على الإحصائيات:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في الحصول على الإحصائيات',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.get('/api/users/search', async (req, res) => {
  try {
    const { query, userType, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const searchQuery = { isActive: true };

    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { 'agencyInfo.agencyName': { $regex: query, $options: 'i' } }
      ];
    }

    if (userType) {
      searchQuery.userType = userType;
    }

    const users = await User.find(searchQuery)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await User.countDocuments(searchQuery);

    res.json({
      status: 'success',
      message: 'تم البحث بنجاح',
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + users.length < totalCount,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    logger.error('خطأ في البحث عن المستخدمين:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في البحث عن المستخدمين',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    
    res.json({
      status: 'success',
      message: 'تم جلب المستخدمين بنجاح',
      data: users
    });
  } catch (error) {
    logger.error('خطأ في جلب المستخدمين:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب المستخدمين'
    });
  }
});

app.patch('/api/admin/users/:userId/toggle-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'المستخدم غير موجود'
      });
    }
    
    user.isActive = !user.isActive;
    await user.save();
    
    res.json({
      status: 'success',
      message: `تم ${user.isActive ? 'تفعيل' : 'إلغاء تفعيل'} المستخدم بنجاح`,
      data: { isActive: user.isActive }
    });
  } catch (error) {
    logger.error('خطأ في تغيير حالة المستخدم:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تغيير حالة المستخدم'
    });
  }
});

// دالة لحساب المدة منذ الرفع
const getTimeAgo = (date) => {
  const now = new Date();
  const diffInMs = now - new Date(date);
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 60) {
    return 'منذ لحظات';
  } else if (diffInMinutes < 60) {
    return `منذ ${diffInMinutes} ${diffInMinutes === 1 ? 'دقيقة' : 'دقائق'}`;
  } else if (diffInHours < 24) {
    return `منذ ${diffInHours} ${diffInHours === 1 ? 'ساعة' : 'ساعات'}`;
  } else if (diffInDays < 30) {
    return `منذ ${diffInDays} ${diffInDays === 1 ? 'يوم' : 'أيام'}`;
  } else {
    const diffInMonths = Math.floor(diffInDays / 30);
    return `منذ ${diffInMonths} ${diffInMonths === 1 ? 'شهر' : 'أشهر'}`;
  }
};

// دالة لبناء العنوان الكامل
const buildFullAddress = (location) => {
  if (!location) return 'غير محدد';
  
  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.district) parts.push(location.district);
  if (location.neighborhood) parts.push(location.neighborhood);
  if (location.address) parts.push(location.address);
  
  return parts.length > 0 ? parts.join(' - ') : 'غير محدد';
};

app.get('/api/admin/properties', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // الحصول على فلتر الحالة من query (افتراضي: جميع العقارات)
    const { status } = req.query;
    
    // بناء query بناءً على الحالة المطلوبة
    const query = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }
    
    const properties = await Property.find(query)
      .populate('owner', 'name email phone profileImage userType agencyInfo location')
      .sort({ createdAt: -1 });
    
    // إضافة معلومات إضافية لكل عقار
    const propertiesWithDetails = properties.map(property => {
      const propertyObj = property.toObject();
      
      // العنوان الكامل
      propertyObj.fullAddress = buildFullAddress(property.location);
      
      // المدة منذ الرفع
      propertyObj.timeAgo = getTimeAgo(property.createdAt);
      
      // معلومات المستخدم الكاملة
      if (propertyObj.owner) {
        propertyObj.ownerInfo = {
          name: propertyObj.owner.name,
          email: propertyObj.owner.email,
          phone: propertyObj.owner.phone,
          userType: propertyObj.owner.userType,
          agencyName: propertyObj.owner.agencyInfo?.agencyName || null,
          location: propertyObj.owner.location || null
        };
      }
      
      return propertyObj;
    });
    
    res.json({
      status: 'success',
      message: 'تم جلب العقارات بنجاح',
      data: propertiesWithDetails
    });
  } catch (error) {
    logger.error('خطأ في جلب العقارات:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب العقارات',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.patch('/api/admin/properties/:propertyId/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: 'حالة غير صحيحة'
      });
    }
    
    const property = await Property.findById(propertyId);
    
    if (!property) {
      return res.status(404).json({
        status: 'error',
        message: 'العقار غير موجود'
      });
    }
    
    property.status = status;
    property.updatedAt = new Date();
    
    // إذا تمت الموافقة على العقار، نشره تلقائياً
    if (status === 'approved') {
      property.isPublished = true;
      property.publishedAt = new Date();
    } else if (status === 'rejected') {
      // عند الرفض، نمنع النشر
      property.isPublished = false;
    }
    
    await property.save();
    
    res.json({
      status: 'success',
      message: `تم ${status === 'approved' ? 'اعتماد ونشر' : status === 'rejected' ? 'رفض' : 'تحديث'} العقار بنجاح`,
      data: { 
        status: property.status,
        isPublished: property.isPublished
      }
    });
  } catch (error) {
    logger.error('خطأ في تحديث حالة العقار:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في تحديث حالة العقار',
      error: process.env.NODE_ENV === 'development' ? error.message : 'خطأ غير معروف'
    });
  }
});

app.delete('/api/admin/properties/:propertyId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { propertyId } = req.params;
    
    const property = await Property.findById(propertyId);
    
    if (!property) {
      return res.status(404).json({
        status: 'error',
        message: 'العقار غير موجود'
      });
    }
    
    await Property.findByIdAndDelete(propertyId);
    
    res.json({
      status: 'success',
      message: 'تم حذف العقار بنجاح'
    });
  } catch (error) {
    logger.error('خطأ في حذف العقار:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في حذف العقار'
    });
  }
});

app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const totalProperties = await Property.countDocuments();
    const pendingProperties = await Property.countDocuments({ status: 'pending' });
    const approvedProperties = await Property.countDocuments({ status: 'approved' });
    const rejectedProperties = await Property.countDocuments({ status: 'rejected' });
    
    const propertiesByType = await Property.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const usersByType = await User.aggregate([
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      status: 'success',
      message: 'تم جلب الإحصائيات بنجاح',
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          byType: usersByType
        },
        properties: {
          total: totalProperties,
          pending: pendingProperties,
          approved: approvedProperties,
          rejected: rejectedProperties,
          byType: propertiesByType
        }
      }
    });
  } catch (error) {
    logger.error('خطأ في جلب الإحصائيات:', error);
    res.status(500).json({
      status: 'error',
      message: 'خطأ في جلب الإحصائيات'
    });
  }
});

// ============================================
// ERROR HANDLERS
// ============================================

// Global Error Handler - معالجة أفضل للأخطاء
app.use((err, req, res, next) => {
  // تسجيل الخطأ بشكل آمن
  logger.error('خطأ في الخادم:', {
    message: err.message,
    stack: isProduction ? undefined : err.stack, // لا نعرض Stack في الإنتاج
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // لا نعرض تفاصيل الخطأ في الإنتاج
  const errorMessage = isProduction 
    ? 'حدث خطأ داخلي في الخادم' 
    : err.message;

  // تحديد كود الحالة المناسب
  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    status: 'error',
    message: errorMessage,
    ...(isProduction ? {} : { 
      error: err.message,
      stack: err.stack 
    })
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'المسار غير موجود'
  });
});

// ============================================
// START SERVER
// ============================================

const startServer = async () => {
  try {
    logger.log('🚀 بدء تشغيل الخادم...');
    
    // الاتصال بقاعدة البيانات أولاً (مهم جداً!)
    const dbConnected = await connectDatabase();
    
    if (!dbConnected) {
      logger.error('❌ فشل الاتصال بقاعدة البيانات. الخادم لن يبدأ.');
      process.exit(1);
    }
    
    // الانتظار قليلاً للتأكد من اكتمال الاتصال
    if (mongoose.connection.readyState !== 1) {
      logger.log('⏳ انتظار اكتمال الاتصال بقاعدة البيانات...');
      await new Promise((resolve) => {
        const checkConnection = () => {
          if (mongoose.connection.readyState === 1) {
            resolve();
          } else {
            setTimeout(checkConnection, 500);
          }
        };
        checkConnection();
      });
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
      if (!isProduction) {
        logger.log(`🌐 رابط الخادم: http://localhost:${PORT}`);
      }
      logger.log(`📊 حالة قاعدة البيانات: ${mongoose.connection.readyState === 1 ? '✅ متصل' : '❌ غير متصل'}`);
      
      // عرض المسارات فقط في التطوير
      if (!isProduction) {
        logger.log('🔗 المسارات المتاحة:');
        logger.log('   - POST /api/auth/register - تسجيل مستخدم جديد');
        logger.log('   - POST /api/auth/login - تسجيل الدخول');
        logger.log('   - GET /api/properties - الحصول على العقارات');
        logger.log('   - POST /api/properties - إضافة عقار جديد');
        logger.log('   - GET /api/health - فحص صحة الخادم');
      }
    });
  } catch (error) {
    logger.error('❌ فشل في بدء الخادم:', error.message);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  logger.log('\n🛑 إيقاف الخادم...');
  await mongoose.connection.close();
  logger.log('✅ تم إيقاف الخادم بنجاح');
  process.exit(0);
});

startServer();

export default app;
