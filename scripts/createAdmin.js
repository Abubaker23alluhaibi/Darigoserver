import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// تحميل متغيرات البيئة
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/darigo-real-estate';

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

const User = mongoose.models.User || mongoose.model('User', userSchema);

// الاتصال بقاعدة البيانات
const connectDB = async () => {
  try {
    const mongooseOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
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

    await mongoose.connect(MONGODB_URI, mongooseOptions);
    console.log('✅ تم الاتصال بقاعدة البيانات');
    console.log(`📊 قاعدة البيانات: ${mongoose.connection.name}`);
    return true;
  } catch (error) {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', error.message);
    process.exit(1);
  }
};

// إنشاء حساب المدير
const createAdminUser = async () => {
  try {
    // التحقق من وجود مدير بالفعل
    const existingAdmin = await User.findOne({ email: 'admin@darigo.com' });
    
    if (existingAdmin) {
      console.log('\n⚠️  حساب المدير موجود بالفعل');
      console.log(`📧 البريد الإلكتروني: ${existingAdmin.email}`);
      console.log(`👤 الاسم: ${existingAdmin.name}`);
      console.log(`🔐 نوع المستخدم: ${existingAdmin.userType}`);
      console.log(`✅ الحالة: ${existingAdmin.isActive ? 'نشط' : 'غير نشط'}`);
      
      // إذا كان موجود لكن ليس admin، نحدثه
      if (existingAdmin.userType !== 'admin') {
        console.log('\n🔄 تحديث نوع المستخدم إلى admin...');
        existingAdmin.userType = 'admin';
        existingAdmin.isActive = true;
        await existingAdmin.save();
        console.log('✅ تم تحديث نوع المستخدم إلى admin');
      }
      
      // إعادة تعيين كلمة المرور إذا طلب المستخدم
      console.log('\n💡 لإعادة تعيين كلمة المرور، استخدم:');
      console.log('   node scripts/resetAdminPassword.js');
      
      return;
    }

    // بيانات المدير الافتراضية
    const adminData = {
      name: 'مدير النظام',
      email: 'admin@darigo.com',
      password: 'admin123',
      userType: 'admin',
      isActive: true,
      isVerified: true,
      phone: '07700000000'
    };

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(adminData.password, 12);

    // إنشاء المستخدم
    const adminUser = new User({
      ...adminData,
      password: hashedPassword
    });

    await adminUser.save();

    console.log('\n✅ تم إنشاء حساب المدير بنجاح!');
    console.log('\n📋 بيانات تسجيل الدخول:');
    console.log('   📧 البريد الإلكتروني: admin@darigo.com');
    console.log('   🔑 كلمة المرور: admin123');
    console.log('\n⚠️  يرجى تغيير كلمة المرور بعد تسجيل الدخول الأول');

  } catch (error) {
    console.error('\n❌ خطأ في إنشاء حساب المدير:', error.message);
    if (error.code === 11000) {
      console.error('   السبب: البريد الإلكتروني موجود بالفعل');
    }
  }
};

// تشغيل السكريبت
const runScript = async () => {
  try {
    await connectDB();
    await createAdminUser();
    await mongoose.connection.close();
    console.log('\n✅ تم إغلاق الاتصال بقاعدة البيانات');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    process.exit(1);
  }
};

runScript();

