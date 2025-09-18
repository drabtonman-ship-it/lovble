import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MultiSelect from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as UIDialog from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PRICING, CustomerType, CUSTOMERS } from '@/data/pricing';
import { Printer, Edit2, Trash2, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function normalize(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const num = Number(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? null : num;
}

type MonthKeyAll = 'شهر واحد' | '2 أشهر' | '3 أشهر' | '6 أشهر' | 'سنة كاملة' | 'يوم واحد';

const MONTH_OPTIONS = [
  { key: 'شهر واحد', label: 'شهرياً', months: 1, dbColumn: 'one_month' },
  { key: '2 أشهر', label: 'كل شهرين', months: 2, dbColumn: '2_months' },
  { key: '3 أشهر', label: 'كل 3 أشهر', months: 3, dbColumn: '3_months' },
  { key: '6 أشهر', label: 'كل 6 أشهر', months: 6, dbColumn: '6_months' },
  { key: 'سنة كاملة', label: 'سنوي', months: 12, dbColumn: 'full_year' },
  { key: 'يوم واحد', label: 'يومي', months: 0, dbColumn: 'one_day' },
] as const;

type MonthKey = typeof MONTH_OPTIONS[number]['key'];

const PRIMARY_CUSTOMERS: string[] = ['عادي', 'مسوق', 'شركات'];
const PRIMARY_SENTINEL = '__primary__';

interface PricingCategory {
  id: string;
  name: string;
  level: string;
  created_at: string;
}

interface PricingData {
  id: number;
  size: string;
  billboard_level: string;
  customer_category: string;
  one_month: number;
  '2_months': number;
  '3_months': number;
  '6_months': number;
  full_year: number;
  one_day: number;
}

interface SizeData {
  id: number;
  name: string;
  level: string;
}

export default function PricingList() {
  // الحصول على المستويات من قاعدة البيانات والبيانات الثابتة
  const [dbLevels, setDbLevels] = useState<string[]>([]);
  const staticLevels = useMemo(() => Array.from(new Set(PRICING.map(p => p['المستوى']))), []);
  const allLevels = useMemo(() => Array.from(new Set([...staticLevels, ...dbLevels])), [staticLevels, dbLevels]);

  const [selectedLevel, setSelectedLevel] = useState<string>('A');
  const [selectedMonthKey, setSelectedMonthKey] = useState<MonthKey>('شهر واحد');
  const [sizeFilter, setSizeFilter] = useState<string[]>([]);
  const [otherCustomer, setOtherCustomer] = useState<string>(PRIMARY_SENTINEL);

  // البيانات من قاعدة البيانات
  const [extraCustomers, setExtraCustomers] = useState<string[]>([]);
  const [pricingData, setPricingData] = useState<PricingData[]>([]);
  const [sizesData, setSizesData] = useState<SizeData[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<{ size: string; customer: string; month: MonthKeyAll } | null>(null);

  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addSizeOpen, setAddSizeOpen] = useState(false);
  const [newSize, setNewSize] = useState('');
  const [addLevelOpen, setAddLevelOpen] = useState(false);
  const [newLevel, setNewLevel] = useState('');
  const [deleteLevelOpen, setDeleteLevelOpen] = useState(false);
  const [deletingLevel, setDeletingLevel] = useState('');

  const [printOpen, setPrintOpen] = useState(false);
  const [printCategory, setPrintCategory] = useState<string>(PRIMARY_SENTINEL);

  // حالات التعديل والحذف
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PricingCategory | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [deleteCatOpen, setDeleteCatOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<PricingCategory | null>(null);

  // تحميل البيانات من قاعدة البيانات
  const loadData = async () => {
    try {
      // تحميل الفئات
      const { data: categories, error: catError } = await supabase
        .from('pricing_categories')
        .select('*')
        .order('created_at', { ascending: true });

      if (catError) {
        console.error('خطأ في تحميل الفئات:', catError);
      } else {
        const categoryNames = categories?.map((cat: PricingCategory) => cat.name) || [];
        setExtraCustomers(categoryNames);
      }

      // تحميل بيانات الأسعار
      const { data: pricing, error: pricingError } = await supabase
        .from('pricing')
        .select('*');

      if (pricingError) {
        console.error('خطأ في تحميل الأسعار:', pricingError);
      } else {
        setPricingData(pricing || []);
      }

      // تحميل المقاسات
      const { data: sizes, error: sizesError } = await supabase
        .from('sizes')
        .select('*')
        .order('name');

      if (sizesError) {
        console.error('خطأ في تحميل المقاسات:', sizesError);
      } else {
        setSizesData(sizes || []);
        // استخراج المستويات من المقاسات
        const levels = Array.from(new Set(sizes?.map((s: SizeData) => s.level) || []));
        setDbLevels(levels);
      }
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
    } finally {
      setLoading(false);
    }
  };

  // تحميل البيانات عند بدء التشغيل
  useEffect(() => {
    loadData();
  }, []);

  // تحديث المستوى المحدد عند تحميل البيانات
  useEffect(() => {
    if (allLevels.length > 0 && !allLevels.includes(selectedLevel)) {
      setSelectedLevel(allLevels[0]);
    }
  }, [allLevels, selectedLevel]);

  // إضافة مستوى جديد
  const addNewLevel = async () => {
    const level = newLevel.trim().toUpperCase();
    if (!level) return;

    if (allLevels.includes(level)) {
      toast.error('هذا المستوى موجود بالفعل');
      return;
    }

    try {
      // إضافة المقاسات الأساسية للمستوى الجديد
      const basicSizes = ['13x5', '12x4', '10x4', '8x3', '6x3', '4x3'];
      const sizeInserts = basicSizes.map(size => ({ name: size, level }));

      const { error: sizesError } = await supabase
        .from('sizes')
        .insert(sizeInserts);

      if (sizesError) {
        console.error('خطأ في إضافة المقاسات:', sizesError);
        toast.error('حدث خطأ في إضافة المقاسات للمستوى الجديد');
        return;
      }

      // إضافة فئة المدينة للمستوى الجديد
      const { error: catError } = await supabase
        .from('pricing_categories')
        .insert([{ name: 'المدينة', level }]);

      if (catError) {
        console.error('خطأ في إضافة الفئة:', catError);
        // لا نوقف العملية إذا فشلت إضافة الفئة
      }

      // إعادة تحميل البيانات
      await loadData();
      
      setSelectedLevel(level);
      setAddLevelOpen(false);
      setNewLevel('');
      toast.success(`تم إضافة المستوى ${level} بنجاح`);
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // حذف مستوى
  const deleteLevel = async () => {
    if (!deletingLevel) return;

    try {
      // حذف جميع الأسعار للمستوى
      const { error: pricingError } = await supabase
        .from('pricing')
        .delete()
        .eq('billboard_level', deletingLevel);

      if (pricingError) {
        console.error('خطأ في حذف الأسعار:', pricingError);
      }

      // حذف جميع المقاسات للمستوى
      const { error: sizesError } = await supabase
        .from('sizes')
        .delete()
        .eq('level', deletingLevel);

      if (sizesError) {
        console.error('خطأ في حذف المقاسات:', sizesError);
      }

      // حذف جميع الفئات للمستوى
      const { error: catError } = await supabase
        .from('pricing_categories')
        .delete()
        .eq('level', deletingLevel);

      if (catError) {
        console.error('خطأ في حذف الفئات:', catError);
      }

      // إعادة تحميل البيانات
      await loadData();

      // تغيير المستوى المحدد إذا كان المحذوف
      if (selectedLevel === deletingLevel) {
        setSelectedLevel(allLevels.find(l => l !== deletingLevel) || 'A');
      }

      setDeleteLevelOpen(false);
      setDeletingLevel('');
      toast.success(`تم حذف المستوى ${deletingLevel} بنجاح`);
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  const saveNewCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    
    if (PRIMARY_CUSTOMERS.includes(name)) { 
      setOtherCustomer(PRIMARY_SENTINEL); 
      setAddCatOpen(false); 
      setNewCatName(''); 
      return; 
    }

    try {
      // حفظ في قاعدة البيانات
      const { data, error } = await supabase
        .from('pricing_categories')
        .insert([
          { name, level: selectedLevel }
        ])
        .select();

      if (error) {
        console.error('خطأ في حفظ الفئة:', error);
        toast.error('حدث خطأ في حفظ الفئة');
        return;
      }

      // تحديث الحالة المحلية
      if (!extraCustomers.includes(name)) {
        setExtraCustomers(prev => [...prev, name]);
      }
      
      setOtherCustomer(name);
      setAddCatOpen(false);
      setNewCatName('');
      toast.success('تم إضافة الفئة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // حفظ مقاس جديد في قاعدة البيانات
  const saveNewSize = async () => {
    const sz = newSize.trim();
    if (!sz) return;

    try {
      // التحقق من وجود المقاس
      const { data: existing } = await supabase
        .from('sizes')
        .select('*')
        .eq('name', sz)
        .eq('level', selectedLevel)
        .single();

      if (existing) {
        toast.error('هذا المقاس موجود بالفعل');
        return;
      }

      // إضافة المقاس الجديد
      const { data, error } = await supabase
        .from('sizes')
        .insert([
          { name: sz, level: selectedLevel }
        ])
        .select()
        .single();

      if (error) {
        console.error('خطأ في حفظ المقاس:', error);
        toast.error('حدث خطأ في حفظ المقاس');
        return;
      }

      // تحديث البيانات المحلية
      setSizesData(prev => [...prev, data]);
      setAddSizeOpen(false);
      setNewSize('');
      toast.success('تم إضافة المقاس بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // تعديل فئة موجودة
  const updateCategory = async () => {
    if (!editingCategory || !editCatName.trim()) return;

    const newName = editCatName.trim();
    
    if (PRIMARY_CUSTOMERS.includes(newName)) {
      toast.error('لا يمكن استخدام اسم فئة أساسية');
      return;
    }

    try {
      const { error } = await supabase
        .from('pricing_categories')
        .update({ name: newName })
        .eq('id', editingCategory.id);

      if (error) {
        console.error('خطأ في تحديث الفئة:', error);
        toast.error('حدث خطأ في تحديث الفئة');
        return;
      }

      // تحديث الحالة المحلية
      setExtraCustomers(prev => 
        prev.map(cat => cat === editingCategory.name ? newName : cat)
      );

      // إذا كانت الفئة المحددة هي المحررة، قم بتحديثها
      if (otherCustomer === editingCategory.name) {
        setOtherCustomer(newName);
      }

      setEditCatOpen(false);
      setEditingCategory(null);
      setEditCatName('');
      toast.success('تم تحديث الفئة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // حذف فئة
  const deleteCategory = async () => {
    if (!deletingCategory) return;

    try {
      const { error } = await supabase
        .from('pricing_categories')
        .delete()
        .eq('id', deletingCategory.id);

      if (error) {
        console.error('خطأ في حذف الفئة:', error);
        toast.error('حدث خطأ في حذف الفئة');
        return;
      }

      // تحديث الحالة المحلية
      setExtraCustomers(prev => 
        prev.filter(cat => cat !== deletingCategory.name)
      );

      // إذا كانت الفئة المحذوفة محددة، قم بإعادة تعيينها للأساسية
      if (otherCustomer === deletingCategory.name) {
        setOtherCustomer(PRIMARY_SENTINEL);
      }

      setDeleteCatOpen(false);
      setDeletingCategory(null);
      toast.success('تم حذف الفئة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // فتح نافذة التعديل
  const openEditCategory = async (categoryName: string) => {
    try {
      const { data, error } = await supabase
        .from('pricing_categories')
        .select('*')
        .eq('name', categoryName)
        .single();

      if (error || !data) {
        console.error('خطأ في جلب بيانات الفئة:', error);
        return;
      }

      setEditingCategory(data);
      setEditCatName(data.name);
      setEditCatOpen(true);
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
    }
  };

  // فتح نافذة الحذف
  const openDeleteCategory = async (categoryName: string) => {
    try {
      const { data, error } = await supabase
        .from('pricing_categories')
        .select('*')
        .eq('name', categoryName)
        .single();

      if (error || !data) {
        console.error('خطأ في جلب بيانات الفئة:', error);
        return;
      }

      setDeletingCategory(data);
      setDeleteCatOpen(true);
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
    }
  };

  // الحصول على المقاسات للمستوى المحدد
  const sizesForLevel = useMemo(() => {
    const set = new Set<string>();
    
    // إضافة المقاسات من البيانات الثابتة
    PRICING.filter(r => r['المستوى'] === selectedLevel).forEach(r => set.add(r['المقاس']));
    
    // إضافة المقاسات من قاعدة البيانات
    pricingData
      .filter(p => p.billboard_level === selectedLevel)
      .forEach(p => set.add(p.size));
    
    // إضافة المقاسات من جدول sizes
    sizesData
      .filter(s => s.level === selectedLevel)
      .forEach(s => set.add(s.name));
    
    const arr = Array.from(set);
    return sizeFilter.length ? arr.filter(s => sizeFilter.includes(s)) : arr;
  }, [selectedLevel, sizeFilter, pricingData, sizesData]);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    PRICING.forEach(p => set.add(p['المقاس']));
    pricingData.forEach(p => set.add(p.size));
    sizesData.forEach(s => set.add(s.name));
    return Array.from(set);
  }, [pricingData, sizesData]);

  const otherCategories = useMemo(() => Array.from(new Set([
    ...new Set(PRICING.map(p=>p['الزبون'] as string).filter(c=>!PRIMARY_CUSTOMERS.includes(c))),
    ...extraCustomers,
  ])), [extraCustomers]);

  const getBase = (size: string, customer: string, month: MonthKeyAll): number | null => {
    const row = PRICING.find(r => r['المقاس'] === size && r['المستوى'] === selectedLevel && r['الزبون'] === (customer as any));
    return row ? normalize((row as any)[month]) : null;
  };

  const getVal = (size: string, customer: string, month: MonthKeyAll): number | null => {
    // البحث في قاعدة البيانات أولاً
    const dbRow = pricingData.find(p => 
      p.size === size && 
      p.billboard_level === selectedLevel && 
      p.customer_category === customer
    );
    
    if (dbRow) {
      const monthOption = MONTH_OPTIONS.find(m => m.key === month);
      if (monthOption) {
        const value = (dbRow as any)[monthOption.dbColumn];
        return normalize(value);
      }
    }
    
    // إذا لم توجد في قاعدة البيانات، ابحث في البيانات الثابتة
    return getBase(size, customer, month);
  };

  const setVal = async (size: string, customer: string, month: MonthKeyAll, value: number | null) => {
    try {
      const monthOption = MONTH_OPTIONS.find(m => m.key === month);
      if (!monthOption) return;

      // البحث عن السجل الموجود
      const existingRow = pricingData.find(p => 
        p.size === size && 
        p.billboard_level === selectedLevel && 
        p.customer_category === customer
      );

      const updateData = {
        [monthOption.dbColumn]: value || 0
      };

      if (existingRow) {
        // تحديث السجل الموجود
        const { error } = await supabase
          .from('pricing')
          .update(updateData)
          .eq('id', existingRow.id);

        if (error) {
          console.error('خطأ في تحديث السعر:', error);
          toast.error(`حدث خطأ في تحديث السعر: ${error.message}`);
          return;
        }

        // تحديث البيانات المحلية
        setPricingData(prev => prev.map(p => 
          p.id === existingRow.id 
            ? { ...p, ...updateData }
            : p
        ));
      } else {
        // إنشاء سجل جديد
        const newRow = {
          size,
          billboard_level: selectedLevel,
          customer_category: customer,
          one_month: monthOption.dbColumn === 'one_month' ? (value || 0) : 0,
          '2_months': monthOption.dbColumn === '2_months' ? (value || 0) : 0,
          '3_months': monthOption.dbColumn === '3_months' ? (value || 0) : 0,
          '6_months': monthOption.dbColumn === '6_months' ? (value || 0) : 0,
          full_year: monthOption.dbColumn === 'full_year' ? (value || 0) : 0,
          one_day: monthOption.dbColumn === 'one_day' ? (value || 0) : 0
        };

        const { data, error } = await supabase
          .from('pricing')
          .insert([newRow])
          .select()
          .single();

        if (error) {
          console.error('خطأ في إضافة السعر:', error);
          toast.error(`حدث خطأ في إضافة السعر: ${error.message}`);
          return;
        }

        // إضافة السجل الجديد للبيانات المحلية
        setPricingData(prev => [...prev, data]);
      }

      toast.success('تم حفظ السعر بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  const priceFor = (size: string, customer: string): string => {
    const v = getVal(size, customer, selectedMonthKey);
    return v == null ? '—' : `${v.toLocaleString()} د.ل`;
  };

  const buildPrintHtml = (cat: string) => {
    const cats = cat === PRIMARY_SENTINEL ? PRIMARY_CUSTOMERS : [cat];
    const today = new Date().toLocaleDateString('ar-LY');
    const monthLabel = MONTH_OPTIONS.find(m=>m.key===selectedMonthKey)?.label || 'شهرياً';
    const rows = sizesForLevel.map(size => {
      const cols = cats.map(c => {
        const v = getVal(size, c, selectedMonthKey);
        return v == null ? '—' : `${Number(v).toLocaleString('ar-LY')} د.ل`;
      }).join('</td><td class="cell">');
      return `<tr><td class="size">${size}</td><td class="cell">${cols}</td></tr>`;
    }).join('');

    const headCols = cats.map(c=>`<th class="cell">${c}</th>`).join('');

    return `<!doctype html><html dir="rtl" lang="ar"><head>
      <meta charset="utf-8" />
      <title>طباعة الأسعار</title>
      <style>
        body{font-family:'Cairo','Tajawal',system-ui,sans-serif;color:#111}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
        .title{font-weight:800;font-size:22px}
        .meta{color:#555}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #ddd;padding:8px;text-align:right}
        thead th{background:#f5f5f5}
        .size{font-weight:700;background:#fafafa}
        @media print{button{display:none}}
      </style>
    </head><body>
      <div class="header">
        <div class="title">قائمة الأسعار — مستوى ${selectedLevel} (${monthLabel})</div>
        <div class="meta">${today}</div>
      </div>
      <table>
        <thead>
          <tr><th class="cell">المقاس</th>${headCols}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <div style="margin-top:12px"><button onclick="window.print()">طباعة</button></div>
    </body></html>`;
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildPrintHtml(printCategory));
    w.document.close();
    w.focus();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">جاري تحميل البيانات...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">الأسعار</CardTitle>
              <p className="text-muted-foreground text-sm">إدارة أسعار الخدمات الإعلانية حسب فئة العميل</p>
            </div>
            <div className="flex items-center gap-2">
              {MONTH_OPTIONS.map(opt => (
                <button
                  key={`m-${opt.key}`}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-fast ${selectedMonthKey === opt.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                  onClick={() => setSelectedMonthKey(opt.key)}
                >
                  {opt.months === 1 ? 'شهرياً' : opt.months === 0 ? 'يومي' : opt.label}
                </button>
              ))}
              <div className="mx-3 h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Select value={otherCustomer} onValueChange={setOtherCustomer}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="فئة أخرى" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PRIMARY_SENTINEL}>الأساسية (عادي/مسوق/شركات)</SelectItem>
                    {Array.from(new Set([...new Set(PRICING.map(p=>p['الزبون'] as string).filter(c=>!PRIMARY_CUSTOMERS.includes(c))), ...extraCustomers])).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {otherCustomer !== PRIMARY_SENTINEL && extraCustomers.includes(otherCustomer) && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditCategory(otherCustomer)}
                      title="تعديل الفئة"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => openDeleteCategory(otherCustomer)}
                      title="حذف الفئة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <Button variant="outline" className="ml-2" onClick={() => setAddCatOpen(true)}>إضافة فئة</Button>
              <Button variant="outline" onClick={() => setAddSizeOpen(true)}>إضافة مقاس</Button>
              <Button className="ml-2" onClick={() => setPrintOpen(true)}>
                <Printer className="h-4 w-4 ml-2" /> طباعة الأسعار
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400/40 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 bg-amber-500 text-white font-semibold rounded-lg px-3 py-1 shadow-sm">مستوى {selectedLevel}</span>
              <span className="text-sm text-muted-foreground">أسعار الأحجام حسب فئة العميل</span>
            </div>
            <div className="flex items-center gap-2">
              {allLevels.map(lvl => (
                <button
                  key={`lvl-${String(lvl)}`}
                  onClick={() => setSelectedLevel(lvl)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-fast ${lvl === selectedLevel ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                >
                  {lvl}
                </button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddLevelOpen(true)}
                title="إضافة مستوى جديد"
                className="text-green-600 hover:text-green-700"
              >
                <Plus className="h-4 w-4" />
              </Button>
              {!staticLevels.includes(selectedLevel) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDeletingLevel(selectedLevel);
                    setDeleteLevelOpen(true);
                  }}
                  title="حذف المستوى"
                  className="text-red-500 hover:text-red-700"
                >
                  <Minus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MultiSelect options={allSizes.map(s => ({ label: s, value: s }))} value={sizeFilter} onChange={setSizeFilter} placeholder="تصفية الأحجام" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-muted/20 border-b border-border/30">
                  {(otherCustomer === PRIMARY_SENTINEL ? PRIMARY_CUSTOMERS : [otherCustomer]).map(c => (
                    <th key={`head-${c}`} className="p-3 font-medium">{c}</th>
                  ))}
                  <th className="p-3 text-center w-24 bg-muted/20">الحجم</th>
                </tr>
              </thead>
              <tbody>
                {sizesForLevel.map(size => (
                  <tr key={size} className="border-b border-border/20 hover:bg-background/50">
                    {(otherCustomer === PRIMARY_SENTINEL ? PRIMARY_CUSTOMERS : [otherCustomer]).map(c => {
                      const isEditing = editing && editing.size === size && editing.customer === c && editing.month === selectedMonthKey;
                      const current = getVal(size, c, selectedMonthKey);
                      return (
                        <td key={`col-${c}`} className="p-3">
                          {isEditing ? (
                            <input
                              autoFocus
                              type="number"
                              className="w-24 rounded-md border px-2 py-1 bg-background"
                              defaultValue={current ?? ''}
                              onBlur={(e) => { 
                                const v = e.target.value.trim(); 
                                setVal(size, c, selectedMonthKey, v === '' ? null : Number(v)); 
                                setEditing(null); 
                              }}
                              onKeyDown={(e) => { 
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); 
                                if (e.key === 'Escape') setEditing(null); 
                              }}
                            />
                          ) : (
                            <button 
                              className="text-right w-full text-foreground hover:bg-muted/50 rounded px-2 py-1" 
                              onClick={() => setEditing({ size, customer: c, month: selectedMonthKey })}
                            >
                              {priceFor(size, c)}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-semibold bg-muted/20">{size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* نافذة إضافة مستوى جديد */}
      <UIDialog.Dialog open={addLevelOpen} onOpenChange={setAddLevelOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة مستوى جديد</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أدخل اسم المستوى الجديد (مثال: S, C, D)
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <Input 
            placeholder="اسم المستوى (حرف واحد)" 
            value={newLevel} 
            onChange={e=>setNewLevel(e.target.value)}
            maxLength={1}
          />
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setAddLevelOpen(false)}>إلغاء</Button>
            <Button onClick={addNewLevel} disabled={!newLevel.trim()}>إضافة</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة حذف المستوى */}
      <UIDialog.Dialog open={deleteLevelOpen} onOpenChange={setDeleteLevelOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تأكيد حذف المستوى</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف المستوى <strong>"{deletingLevel}"</strong>؟ 
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                ⚠️ تحذير: سيتم حذف جميع المقاسات والأسعار والفئات المرتبطة بهذا المستوى نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setDeleteLevelOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteLevel}>حذف نهائياً</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة الطباعة */}
      <UIDialog.Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>طباعة الأسعار</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              اختر الفئة التي تريد طباعة أسعارها
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="grid gap-3">
            <Select value={printCategory} onValueChange={setPrintCategory}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PRIMARY_SENTINEL}>الأساسية (عادي/مسوق/شركات)</SelectItem>
                {otherCategories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setPrintOpen(false)}>إلغاء</Button>
            <Button onClick={handlePrint}>طباعة</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة إضافة فئة جديدة */}
      <UIDialog.Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة فئة جديدة</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أدخل اسم الفئة الجديدة التي تريد إضافتها
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <Input placeholder="اسم الفئة (مثال: المدينة)" value={newCatName} onChange={e=>setNewCatName(e.target.value)} />
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setAddCatOpen(false)}>إلغاء</Button>
            <Button onClick={saveNewCategory}>حفظ</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة تعديل الفئة */}
      <UIDialog.Dialog open={editCatOpen} onOpenChange={setEditCatOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تعديل الفئة</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              قم بتعديل اسم الفئة المحددة
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">الاسم الحالي: {editingCategory?.name}</label>
            </div>
            <Input 
              placeholder="اسم الفئة الجديد" 
              value={editCatName} 
              onChange={e=>setEditCatName(e.target.value)}
              autoFocus
            />
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setEditCatOpen(false)}>إلغاء</Button>
            <Button onClick={updateCategory} disabled={!editCatName.trim()}>تحديث</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة تأكيد الحذف */}
      <UIDialog.Dialog open={deleteCatOpen} onOpenChange={setDeleteCatOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تأكيد الحذف</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف الفئة <strong>"{deletingCategory?.name}"</strong>؟ 
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                ⚠️ تحذير: سيتم حذف جميع الأسعار المرتبطة بهذه الفئة نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setDeleteCatOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteCategory}>حذف نهائياً</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة إضافة مقاس */}
      <UIDialog.Dialog open={addSizeOpen} onOpenChange={setAddSizeOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة مقاس</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أدخل المقاس الجديد الذي تريد إضافته للمستوى {selectedLevel}
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <Input placeholder="أدخل المقاس (مثال 4x12)" value={newSize} onChange={e=>setNewSize(e.target.value)} />
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setAddSizeOpen(false)}>إلغاء</Button>
            <Button onClick={saveNewSize}>حفظ</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </div>
  );
}