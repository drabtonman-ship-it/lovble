// هذا الملف محدث ليستخدم قاعدة البيانات بدلاً من البيانات الثابتة
export {
  getPriceFor,
  getDailyPriceFor,
  getAvailableSizes,
  getAvailableLevels,
  getAllPricing as PRICING,
  getCustomerCategories,
} from '@/services/pricingService';

export type { CustomerType, LevelType } from '@/services/pricingService';

// استيراد للحصول على قيمة مبدئية متزامنة للفئات
import { getCustomerCategories } from '@/services/pricingService';

// تصدير فوري للفئات (للتوافق مع الكود الموجود)
export const CUSTOMERS = await getCustomerCategories().catch(() => ['عادي', 'المدينة', 'مسوق', 'شركات']);
