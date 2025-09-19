import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import { Edit, Trash2, Printer, Plus, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  contract_number: string | null;
  amount: number | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  paid_at: string | null;
  entry_type: 'invoice' | 'receipt' | 'debt' | 'account_payment' | string | null;
}

interface ContractRow {
  Contract_Number: string | null;
  'Customer Name': string | null;
  'Ad Type': string | null;
  'Total Rent': string | number | null;
  'Start Date'?: string | null;
  'End Date'?: string | null;
  customer_id?: string | null;
  'Number of Boards'?: number | null;
}

interface InvoiceItem {
  contractNumber: string;
  adType: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface PrintInvoiceItem {
  contractNumber: string;
  adType: string;
  selected: boolean;
  units: number;
  pricePerUnit: number;
  total: number;
  numberOfBoards: number;
}

export default function CustomerBilling() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const paramId = params.get('id') || '';
  const paramName = params.get('name') || '';

  const [customerId, setCustomerId] = useState<string>(paramId);
  const [customerName, setCustomerName] = useState<string>(paramName);

  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [installationPrices, setInstallationPrices] = useState<any[]>([]);

  const [addReceiptOpen, setAddReceiptOpen] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptMethod, setReceiptMethod] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptDate, setReceiptDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [receiptContract, setReceiptContract] = useState<string>('');

  const [editReceiptOpen, setEditReceiptOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<PaymentRow | null>(null);
  const [editReceiptAmount, setEditReceiptAmount] = useState('');
  const [editReceiptMethod, setEditReceiptMethod] = useState('');
  const [editReceiptReference, setEditReceiptReference] = useState('');
  const [editReceiptNotes, setEditReceiptNotes] = useState('');
  const [editReceiptDate, setEditReceiptDate] = useState('');

  const [addDebtOpen, setAddDebtOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNotes, setDebtNotes] = useState('');
  const [debtDate, setDebtDate] = useState<string>(()=> new Date().toISOString().slice(0,10));

  // Print invoice states
  const [printInvoiceOpen, setPrintInvoiceOpen] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [includeAccountBalance, setIncludeAccountBalance] = useState(false);

  // Print installation invoice states
  const [printInstallationInvoiceOpen, setPrintInstallationInvoiceOpen] = useState(false);
  const [printInvoiceItems, setPrintInvoiceItems] = useState<PrintInvoiceItem[]>([]);
  const [printInvoiceReason, setPrintInvoiceReason] = useState('');
  const [defaultPrintPrice, setDefaultPrintPrice] = useState(0);

  // Account payment dialog states
  const [accountPaymentOpen, setAccountPaymentOpen] = useState(false);
  const [accountPaymentAmount, setAccountPaymentAmount] = useState('');
  const [accountPaymentMethod, setAccountPaymentMethod] = useState('');
  const [accountPaymentReference, setAccountPaymentReference] = useState('');
  const [accountPaymentNotes, setAccountPaymentNotes] = useState('');
  const [accountPaymentDate, setAccountPaymentDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [accountPaymentContract, setAccountPaymentContract] = useState('');
  const [accountPaymentToGeneral, setAccountPaymentToGeneral] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Resolve name if only id is provided or vice versa
        if (customerId && !customerName) {
          const { data } = await supabase.from('customers').select('name').eq('id', customerId).single();
          setCustomerName(data?.name || '');
        }
        if (!customerId && customerName) {
          const { data } = await supabase.from('customers').select('id').ilike('name', customerName).limit(1).maybeSingle();
          if (data?.id) setCustomerId(data.id);
        }
      } catch {}
    })();
  }, [customerId, customerName]);

  const loadData = async () => {
    try {
      let paymentsData: PaymentRow[] = [];
      if (customerId) {
        const p = await supabase.from('customer_payments').select('*').eq('customer_id', customerId).order('paid_at', { ascending: false });
        if (!p.error) paymentsData = p.data || [];
      }
      if ((!paymentsData || paymentsData.length === 0) && customerName) {
        const p = await supabase.from('customer_payments').select('*').ilike('customer_name', `%${customerName}%`).order('paid_at', { ascending: false });
        if (!p.error) paymentsData = p.data || [];
      }
      setPayments(paymentsData);

      let contractsData: ContractRow[] = [];
      if (customerId) {
        const c = await supabase.from('Contract').select('*').eq('customer_id', customerId);
        if (!c.error) contractsData = c.data || [];
      }
      if ((!contractsData || contractsData.length === 0) && customerName) {
        const c = await supabase.from('Contract').select('*').ilike('Customer Name', `%${customerName}%`);
        if (!c.error) contractsData = c.data || [];
      }
      setContracts(contractsData);

      // Load installation prices
      const { data: pricesData } = await supabase.from('installation_prices').select('*');
      if (pricesData) {
        setInstallationPrices(pricesData);
        // Set default print price from installation prices (assuming there's a print/installation price)
        const printPrice = pricesData.find(p => p.service_type?.toLowerCase().includes('طباعة') || p.service_type?.toLowerCase().includes('تركيب'));
        if (printPrice) {
          setDefaultPrintPrice(Number(printPrice.price) || 0);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('فشل تحميل البيانات');
    }
  };

  useEffect(() => { loadData(); }, [customerId, customerName]);

  const totalRent = useMemo(() => contracts.reduce((s, c) => s + (Number(c['Total Rent']) || 0), 0), [contracts]);
  const totalPaid = useMemo(() => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);
  const balance = Math.max(0, totalRent - totalPaid);

  // Calculate account payments (payments not tied to specific contracts)
  const accountPayments = useMemo(() => 
    payments.filter(p => !p.contract_number || p.entry_type === 'account_payment')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);

  // Get active contracts (current date is between start and end date)
  const activeContracts = useMemo(() => {
    const today = new Date();
    return contracts.filter(contract => {
      const startDate = contract['Start Date'] ? new Date(contract['Start Date']) : null;
      const endDate = contract['End Date'] ? new Date(contract['End Date']) : null;
      
      if (!startDate || !endDate) return true; // Include if dates are missing
      
      return today >= startDate && today <= endDate;
    });
  }, [contracts]);

  // Get contract details for selected contract
  const getContractDetails = (contractNumber: string) => {
    const contract = contracts.find(c => String(c.Contract_Number) === contractNumber);
    if (!contract) return null;
    
    const contractTotal = Number(contract['Total Rent']) || 0;
    const contractPayments = payments.filter(p => p.contract_number === contractNumber)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const contractRemaining = Math.max(0, contractTotal - contractPayments);
    
    return {
      total: contractTotal,
      paid: contractPayments,
      remaining: contractRemaining,
      adType: contract['Ad Type'] || ''
    };
  };

  const openEditReceipt = (payment: PaymentRow) => {
    setEditingReceipt(payment);
    setEditReceiptAmount(String(payment.amount || ''));
    setEditReceiptMethod(payment.method || '');
    setEditReceiptReference(payment.reference || '');
    setEditReceiptNotes(payment.notes || '');
    setEditReceiptDate(payment.paid_at ? payment.paid_at.split('T')[0] : '');
    setEditReceiptOpen(true);
  };

  const saveReceiptEdit = async () => {
    if (!editingReceipt) return;
    try {
      const { error } = await supabase.from('customer_payments').update({
        amount: Number(editReceiptAmount) || 0,
        method: editReceiptMethod || null,
        reference: editReceiptReference || null,
        notes: editReceiptNotes || null,
        paid_at: editReceiptDate ? new Date(editReceiptDate).toISOString() : null,
      }).eq('id', editingReceipt.id).select();
      if (error) { 
        console.error('Update error:', error);
        toast.error('فشل في تحديث الإيصال: ' + error.message); 
        return; 
      }
      toast.success('تم تحديث الإيصال');
      setEditReceiptOpen(false); setEditingReceipt(null);
      await loadData();
    } catch (e) {
      console.error(e); toast.error('خطأ في حفظ الإيصال');
    }
  };

  const deleteReceipt = async (id: string) => {
    if (!window.confirm('تأكيد حذف الإيصال؟')) return;
    try {
      const { error } = await supabase.from('customer_payments').delete().eq('id', id);
      if (error) { toast.error('فشل الحذف'); return; }
      toast.success('تم الحذف');
      await loadData();
    } catch (e) { console.error(e); toast.error('خطأ في الحذف'); }
  };

  const printStatement = () => {
    const rows = payments.slice().sort((a,b)=> (new Date(a.paid_at||'').getTime()) - (new Date(b.paid_at||'').getTime()));
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8" />
      <title>كشف حساب - ${customerName}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;max-width:900px;margin:auto}
      h1{font-size:22px;margin:0 0 10px} table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #ddd;padding:8px;text-align:center} .right{text-align:right}
      .summary{margin-top:12px}</style></head><body>
      <h1>كشف حساب</h1>
      <div class="right">العميل: ${customerName}</div>
      <div class="right">إجمالي العقود: ${totalRent.toLocaleString('ar-LY')} د.ل</div>
      <div class="right">إجمالي المدفوع: ${totalPaid.toLocaleString('ar-LY')} د.ل</div>
      <div class="right">المتبقي: ${balance.toLocaleString('ar-LY')} د.ل</div>
      <div class="right">رصيد الحساب العام: ${accountPayments.toLocaleString('ar-LY')} د.ل</div>
      <table><thead><tr><th>التاريخ</th><th>النوع</th><th>العقد</th><th>المبلغ</th><th>المرجع</th><th>ملاحظات</th></tr></thead><tbody>
      ${rows.map(r=> `<tr><td>${r.paid_at ? new Date(r.paid_at).toLocaleDateString('ar-LY') : ''}</td><td>${r.entry_type||''}</td><td>${r.contract_number||'حساب عام'}</td><td>${(Number(r.amount)||0).toLocaleString('ar-LY')} د.ل</td><td>${r.reference||''}</td><td>${r.notes||''}</td></tr>`).join('')}
      </tbody></table>
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;
    const w = window.open('', '_blank'); if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  };

  const initializeInvoiceItems = () => {
    const items = contracts.map(contract => ({
      contractNumber: String(contract.Contract_Number || ''),
      adType: contract['Ad Type'] || '',
      quantity: 1,
      unitPrice: Number(contract['Total Rent']) || 0,
      total: Number(contract['Total Rent']) || 0
    }));
    setInvoiceItems(items);
  };

  const initializePrintInvoiceItems = () => {
    const items = activeContracts.map(contract => ({
      contractNumber: String(contract.Contract_Number || ''),
      adType: contract['Ad Type'] || '',
      selected: false,
      units: Number(contract['Number of Boards']) || 1,
      pricePerUnit: defaultPrintPrice,
      total: 0,
      numberOfBoards: Number(contract['Number of Boards']) || 1
    }));
    setPrintInvoiceItems(items);
  };

  const updateInvoiceItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...invoiceItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    
    setInvoiceItems(newItems);
  };

  const updatePrintInvoiceItem = (index: number, field: keyof PrintInvoiceItem, value: any) => {
    const newItems = [...printInvoiceItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'units' || field === 'pricePerUnit' || field === 'selected') {
      newItems[index].total = newItems[index].selected ? (newItems[index].units * newItems[index].pricePerUnit) : 0;
    }
    
    setPrintInvoiceItems(newItems);
  };

  const printCustomInvoice = () => {
    const selectedItems = invoiceItems.filter(item => item.quantity > 0);
    
    if (selectedItems.length === 0) {
      toast.error('يرجى اختيار عنصر واحد على الأقل');
      return;
    }

    const totalAmount = selectedItems.reduce((sum, item) => sum + item.total, 0);
    const accountBalanceAmount = includeAccountBalance ? accountPayments : 0;
    const finalTotal = totalAmount + accountBalanceAmount;

    const itemRows = selectedItems.map(item => `
      <tr>
        <td>${item.contractNumber}</td>
        <td>${item.adType}</td>
        <td>${item.quantity}</td>
        <td>${item.unitPrice.toLocaleString('ar-LY')} د.ل</td>
        <td>${item.total.toLocaleString('ar-LY')} د.ل</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <title>فاتورة - ${customerName}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;max-width:900px;margin:auto}
        h1{font-size:24px;text-align:center;margin-bottom:20px}
        .customer-info{margin-bottom:20px;background:#f9f9f9;padding:15px;border-radius:5px}
        table{width:100%;border-collapse:collapse;margin:10px 0}
        th,td{border:1px solid #ddd;padding:8px;text-align:center}
        th{background:#f5f5f5;font-weight:bold}
        .total-row{background:#e8f5e8;font-weight:bold}
        .footer{margin-top:30px;text-align:center;color:#666}
      </style></head><body>
      <h1>فاتورة مخصصة</h1>
      <div class="customer-info">
        <strong>العميل:</strong> ${customerName}<br>
        <strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-LY')}<br>
        <strong>عدد العناصر:</strong> ${selectedItems.length}
      </div>
      
      <h3>تفاصيل الفاتورة:</h3>
      <table>
        <thead>
          <tr>
            <th>رقم العقد</th>
            <th>نوع الإعلان</th>
            <th>الكمية</th>
            <th>سعر الوحدة</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr class="total-row">
            <td colspan="4">إجمالي الفاتورة</td>
            <td>${totalAmount.toLocaleString('ar-LY')} د.ل</td>
          </tr>
          ${includeAccountBalance ? `
          <tr>
            <td colspan="4">رصيد الحساب العام</td>
            <td>${accountBalanceAmount.toLocaleString('ar-LY')} د.ل</td>
          </tr>
          <tr class="total-row">
            <td colspan="4">الإجمالي النهائي</td>
            <td>${finalTotal.toLocaleString('ar-LY')} د.ل</td>
          </tr>
          ` : ''}
        </tbody>
      </table>
      
      <div class="footer">
        <p>شكراً لتعاملكم معنا</p>
      </div>
      
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;

    const w = window.open('', '_blank'); 
    if (w) { 
      w.document.open(); 
      w.document.write(html); 
      w.document.close(); 
    }
  };

  const printInstallationInvoice = () => {
    const selectedItems = printInvoiceItems.filter(item => item.selected && item.units > 0);
    
    if (selectedItems.length === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل وتحديد عدد الوحدات');
      return;
    }

    if (!printInvoiceReason.trim()) {
      toast.error('يرجى كتابة سبب الطباعة');
      return;
    }

    const totalAmount = selectedItems.reduce((sum, item) => sum + item.total, 0);

    const html = `<!DOCTYPE html>
<html dir='rtl'>
<head>
    <meta charset='utf-8'>
    <title>فاتورة طباعة وتركيب - ${customerName}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Cairo', Arial, sans-serif;
            background: #f8f9fa;
            color: #2c3e50;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        .invoice-container {
            max-width: 400px;
            margin: 20px auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            page-break-inside: avoid;
        }
        
        .header {
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            padding: 30px 25px;
            text-align: center;
            position: relative;
        }
        
        .receipt-number {
            position: absolute;
            top: 15px;
            right: 20px;
            background: #2c3e50;
            color: #FFD700;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
        }
        
        .logo-section {
            margin-bottom: 20px;
        }
        
        .logo-placeholder {
            width: 80px;
            height: 80px;
            margin: 0 auto 15px;
            background: #2c3e50;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFD700;
            font-size: 24px;
            font-weight: 700;
        }
        
        .company-name {
            font-size: 28px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 8px;
            text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
        }
        
        .company-subtitle {
            font-size: 16px;
            color: #34495e;
            margin-bottom: 20px;
            font-weight: 500;
        }
        
        .title {
            background: white;
            color: #2c3e50;
            padding: 12px 25px;
            border-radius: 25px;
            font-size: 20px;
            font-weight: 700;
            display: inline-block;
            border: 2px solid #2c3e50;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .content {
            padding: 25px;
        }
        
        .info-section {
            background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            border-left: 5px solid #FFD700;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #FFD700;
            font-size: 15px;
        }
        
        .info-row:last-child {
            border-bottom: none;
        }
        
        .label {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .value {
            font-weight: 500;
            color: #34495e;
        }
        
        .amount-highlight {
            background: #2c3e50;
            color: #FFD700;
            padding: 6px 12px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 16px;
        }
        
        .reason-section {
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            border-left: 5px solid #2196f3;
            text-align: center;
        }
        
        .reason-title {
            font-size: 16px;
            font-weight: 700;
            color: #1976d2;
            margin-bottom: 10px;
        }
        
        .reason-text {
            font-size: 14px;
            color: #2c3e50;
            font-weight: 500;
            line-height: 1.5;
        }
        
        .total-section {
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            margin: 20px 0;
            border: 3px solid #2c3e50;
        }
        
        .total-label {
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .total-amount {
            font-size: 32px;
            font-weight: 700;
            color: #2c3e50;
            text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
        }
        
        .footer {
            background: #2c3e50;
            color: #FFD700;
            text-align: center;
            padding: 20px;
            font-size: 13px;
            font-weight: 500;
        }
        
        .contact-info {
            margin-top: 8px;
            font-size: 11px;
            opacity: 0.9;
        }
        
        @media print {
            body {
                background: white !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .invoice-container {
                box-shadow: none !important;
                margin: 0 !important;
                max-width: none !important;
                page-break-inside: avoid !important;
            }
            
            .header {
                background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%) !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .total-section {
                background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%) !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .footer {
                background: #2c3e50 !important;
                color: #FFD700 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .amount-highlight {
                background: #2c3e50 !important;
                color: #FFD700 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="receipt-number">#${Date.now().toString().slice(-6)}</div>
            
            <div class="logo-section">
                <div class="logo-placeholder">فارس</div>
            </div>
            
            <div class="company-name">شركة فارس</div>
            <div class="company-subtitle">للإعلانات والتسويق</div>
            <div class="title">إيصال دفع</div>
        </div>
        
        <div class="content">
            <div class="info-section">
                <div class="info-row">
                    <span class="label">العميل:</span>
                    <span class="value">${customerName}</span>
                </div>
                <div class="info-row">
                    <span class="label">رقم العقد:</span>
                    <span class="value">${selectedItems.map(item => item.contractNumber).join(', ')}</span>
                </div>
                <div class="info-row">
                    <span class="label">النوع:</span>
                    <span class="value">إيصال</span>
                </div>
                <div class="info-row">
                    <span class="label">المبلغ:</span>
                    <span class="value amount-highlight">${totalAmount.toLocaleString('ar-LY')} د.ل</span>
                </div>
                <div class="info-row">
                    <span class="label">التاريخ:</span>
                    <span class="value">${new Date().toLocaleDateString('ar-LY')}</span>
                </div>
                <div class="info-row">
                    <span class="label">طريقة الدفع:</span>
                    <span class="value">شيك</span>
                </div>
                <div class="info-row">
                    <span class="label">المرجع:</span>
                    <span class="value">—</span>
                </div>
                <div class="info-row">
                    <span class="label">ملاحظات:</span>
                    <span class="value">—</span>
                </div>
            </div>
            
            <div class="reason-section">
                <div class="reason-title">سبب الطباعة والتركيب</div>
                <div class="reason-text">${printInvoiceReason}</div>
            </div>
            
            <div class="total-section">
                <div class="total-label">الرصيد المتبقي بعد الدفع</div>
                <div class="total-amount">${totalAmount.toLocaleString('ar-LY')} د.ل</div>
            </div>
        </div>
        
        <div class="footer">
            <div>شكراً لتعاملكم معنا</div>
            <div class="contact-info">
                هاتف: 123-456-789 | البريد: info@fares-ads.com
            </div>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        }
    </script>
</body>
</html>`;
    
    const w = window.open('', '_blank'); 
    if (w) { 
      w.document.open(); 
      w.document.write(html); 
      w.document.close(); 
    }
  };

  const printReceiptWithBackground = (payment: PaymentRow) => {
    const paymentAmount = Number(payment.amount) || 0;
    const remainingAfterPayment = Math.max(0, balance - paymentAmount);
    
    const html = `<!DOCTYPE html>
<html dir='rtl'>
<head>
    <meta charset='utf-8'>
    <title>إيصال دفع - شركة فارس</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Cairo', Arial, sans-serif;
            background: #f8f9fa;
            color: #2c3e50;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        .invoice-container {
            max-width: 400px;
            margin: 20px auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            page-break-inside: avoid;
        }
        
        .header {
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            padding: 30px 25px;
            text-align: center;
            position: relative;
        }
        
        .receipt-number {
            position: absolute;
            top: 15px;
            right: 20px;
            background: #2c3e50;
            color: #FFD700;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
        }
        
        .logo-section {
            margin-bottom: 20px;
        }
        
        .logo-placeholder {
            width: 80px;
            height: 80px;
            margin: 0 auto 15px;
            background: #2c3e50;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FFD700;
            font-size: 24px;
            font-weight: 700;
        }
        
        .company-name {
            font-size: 28px;
            font-weight: 700;
            color: #2c3e50;
            margin-bottom: 8px;
            text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
        }
        
        .company-subtitle {
            font-size: 16px;
            color: #34495e;
            margin-bottom: 20px;
            font-weight: 500;
        }
        
        .title {
            background: white;
            color: #2c3e50;
            padding: 12px 25px;
            border-radius: 25px;
            font-size: 20px;
            font-weight: 700;
            display: inline-block;
            border: 2px solid #2c3e50;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        
        .content {
            padding: 25px;
        }
        
        .info-section {
            background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
            border-left: 5px solid #FFD700;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #FFD700;
            font-size: 15px;
        }
        
        .info-row:last-child {
            border-bottom: none;
        }
        
        .label {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .value {
            font-weight: 500;
            color: #34495e;
        }
        
        .amount-highlight {
            background: #2c3e50;
            color: #FFD700;
            padding: 6px 12px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 16px;
        }
        
        .total-section {
            background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            margin: 20px 0;
            border: 3px solid #2c3e50;
        }
        
        .total-label {
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 10px;
        }
        
        .total-amount {
            font-size: 32px;
            font-weight: 700;
            color: #2c3e50;
            text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
        }
        
        .footer {
            background: #2c3e50;
            color: #FFD700;
            text-align: center;
            padding: 20px;
            font-size: 13px;
            font-weight: 500;
        }
        
        .contact-info {
            margin-top: 8px;
            font-size: 11px;
            opacity: 0.9;
        }
        
        @media print {
            body {
                background: white !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .invoice-container {
                box-shadow: none !important;
                margin: 0 !important;
                max-width: none !important;
                page-break-inside: avoid !important;
            }
            
            .header {
                background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%) !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .total-section {
                background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%) !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .footer {
                background: #2c3e50 !important;
                color: #FFD700 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            
            .amount-highlight {
                background: #2c3e50 !important;
                color: #FFD700 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <div class="receipt-number">#${payment.id.slice(-6)}</div>
            
            <div class="logo-section">
                <div class="logo-placeholder">فارس</div>
            </div>
            
            <div class="company-name">شركة فارس</div>
            <div class="company-subtitle">للإعلانات والتسويق</div>
            <div class="title">إيصال دفع</div>
        </div>
        
        <div class="content">
            <div class="info-section">
                <div class="info-row">
                    <span class="label">العميل:</span>
                    <span class="value">${customerName}</span>
                </div>
                <div class="info-row">
                    <span class="label">رقم العقد:</span>
                    <span class="value">${payment.contract_number || 'حساب عام'}</span>
                </div>
                <div class="info-row">
                    <span class="label">النوع:</span>
                    <span class="value">${payment.entry_type === 'account_payment' ? 'دفعة حساب' :
                                       payment.entry_type === 'receipt' ? 'إيصال' :
                                       payment.entry_type === 'debt' ? 'دين سابق' :
                                       payment.entry_type || '—'}</span>
                </div>
                <div class="info-row">
                    <span class="label">المبلغ:</span>
                    <span class="value amount-highlight">${paymentAmount.toLocaleString('ar-LY')} د.ل</span>
                </div>
                <div class="info-row">
                    <span class="label">التاريخ:</span>
                    <span class="value">${payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-LY') : ''}</span>
                </div>
                <div class="info-row">
                    <span class="label">طريقة الدفع:</span>
                    <span class="value">${payment.method || '—'}</span>
                </div>
                <div class="info-row">
                    <span class="label">المرجع:</span>
                    <span class="value">${payment.reference || '—'}</span>
                </div>
                <div class="info-row">
                    <span class="label">ملاحظات:</span>
                    <span class="value">${payment.notes || '—'}</span>
                </div>
            </div>
            
            <div class="total-section">
                <div class="total-label">الرصيد المتبقي بعد الدفع</div>
                <div class="total-amount">${remainingAfterPayment.toLocaleString('ar-LY')} د.ل</div>
            </div>
        </div>
        
        <div class="footer">
            <div>شكراً لتعاملكم معنا</div>
            <div class="contact-info">
                هاتف: 123-456-789 | البريد: info@fares-ads.com
            </div>
        </div>
    </div>
    
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        }
    </script>
</body>
</html>`;
    
    const w = window.open('', '_blank'); 
    if (w) { 
      w.document.open(); 
      w.document.write(html); 
      w.document.close(); 
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">فواتير وإيصالات العميل</h1>
          <p className="text-muted-foreground">{customerName || '—'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/customers')}>رجوع للزبائن</Button>
          <Button onClick={() => {
            initializePrintInvoiceItems();
            setPrintInstallationInvoiceOpen(true);
          }} className="bg-orange-600 hover:bg-orange-700">
            <Printer className="h-4 w-4 ml-2" />
            فاتورة طباعة وتركيب
          </Button>
          <Button onClick={() => {
            initializeInvoiceItems();
            setPrintInvoiceOpen(true);
          }} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="h-4 w-4 ml-2" />
            إضافة فاتورة طباعة
          </Button>
          <Button onClick={printStatement}>طباعة كشف حساب</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">إجمالي العقود</div>
            <div className="text-2xl font-bold">{totalRent.toLocaleString('ar-LY')} د.ل</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">إجمالي المدفوع</div>
            <div className="text-2xl font-bold text-green-600">{totalPaid.toLocaleString('ar-LY')} د.ل</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">المتبقي</div>
            <div className="text-2xl font-bold text-red-600">{balance.toLocaleString('ar-LY')} د.ل</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">رصيد الحساب العام</div>
            <div className="text-2xl font-bold text-blue-600">{accountPayments.toLocaleString('ar-LY')} د.ل</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>عقود العميل ({contracts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم العقد</TableHead>
                    <TableHead>نوع الإعلان</TableHead>
                    <TableHead>عدد اللوحات</TableHead>
                    <TableHead>تاريخ البداية</TableHead>
                    <TableHead>تاريخ النهاية</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>القيمة الإجمالية</TableHead>
                    <TableHead>المدفوع للعقد</TableHead>
                    <TableHead>المتبقي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map(ct => {
                    const contractPayments = payments.filter(p => p.contract_number === String(ct.Contract_Number)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                    const contractTotal = Number(ct['Total Rent']) || 0;
                    const contractRemaining = Math.max(0, contractTotal - contractPayments);
                    
                    // Check if contract is active
                    const today = new Date();
                    const startDate = ct['Start Date'] ? new Date(ct['Start Date']) : null;
                    const endDate = ct['End Date'] ? new Date(ct['End Date']) : null;
                    const isActive = startDate && endDate && today >= startDate && today <= endDate;
                    
                    return (
                      <TableRow key={String(ct.Contract_Number)}>
                        <TableCell className="font-medium">{String(ct.Contract_Number||'')}</TableCell>
                        <TableCell>{ct['Ad Type'] || '—'}</TableCell>
                        <TableCell className="font-semibold text-blue-600">{Number(ct['Number of Boards']) || 0}</TableCell>
                        <TableCell>{ct['Start Date'] ? new Date(ct['Start Date']).toLocaleDateString('ar-LY') : '—'}</TableCell>
                        <TableCell>{ct['End Date'] ? new Date(ct['End Date']).toLocaleDateString('ar-LY') : '—'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {isActive ? 'فعال' : 'منتهي'}
                          </span>
                        </TableCell>
                        <TableCell className="font-semibold">{contractTotal.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-green-600">{contractPayments.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className={contractRemaining > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>{contractRemaining.toLocaleString('ar-LY')} د.ل</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : <div className="text-center text-muted-foreground py-6">لا توجد عقود</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>الدفعات والإيصالات ({payments.length})</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setAddDebtOpen(true); setDebtAmount(''); setDebtNotes(''); setDebtDate(new Date().toISOString().slice(0,10)); }}>إضافة دين سابق</Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setAccountPaymentOpen(true); setAccountPaymentAmount(''); setAccountPaymentMethod(''); setAccountPaymentReference(''); setAccountPaymentNotes(''); setAccountPaymentDate(new Date().toISOString().slice(0,10)); setAccountPaymentContract(''); setAccountPaymentToGeneral(true); }}>
                <Plus className="h-4 w-4 ml-1" />
                دفعة على الحساب
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>رقم العقد</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>طريقة الدفع</TableHead>
                    <TableHead>المرجع</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>ملاحظات</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => {
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.contract_number || (p.entry_type === 'account_payment' ? 'حساب عام' : '—')}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            p.entry_type === 'account_payment' ? 'bg-green-100 text-green-800' :
                            p.entry_type === 'receipt' ? 'bg-blue-100 text-blue-800' :
                            p.entry_type === 'debt' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {p.entry_type === 'account_payment' ? 'دفعة حساب' :
                             p.entry_type === 'receipt' ? 'إيصال' :
                             p.entry_type === 'debt' ? 'دين سابق' :
                             p.entry_type || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-green-600 font-semibold">{(Number(p.amount)||0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>{p.method || '—'}</TableCell>
                        <TableCell>{p.reference || '—'}</TableCell>
                        <TableCell>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('ar-LY') : '—'}</TableCell>
                        <TableCell>{p.notes || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => printReceiptWithBackground(p)}>
                              طباعة إيصال
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openEditReceipt(p)}><Edit className="h-4 w-4" /></Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteReceipt(p.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : <div className="text-center text-muted-foreground py-6">لا توجد دفعات</div>}
        </CardContent>
      </Card>

      {/* Account Payment Dialog */}
      <Dialog open={accountPaymentOpen} onOpenChange={setAccountPaymentOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-right">دفعة على الحساب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">العميل:</div>
              <div className="font-semibold">{customerName}</div>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                اختر وجهة الدفعة:
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded border transition-colors" 
                       style={{borderColor: accountPaymentToGeneral ? '#3b82f6' : '#e5e7eb', backgroundColor: accountPaymentToGeneral ? '#eff6ff' : 'transparent'}}>
                  <input
                    type="radio"
                    name="payment-destination"
                    checked={accountPaymentToGeneral}
                    onChange={() => setAccountPaymentToGeneral(true)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">إضافة إلى الحساب العام</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded border transition-colors"
                       style={{borderColor: !accountPaymentToGeneral ? '#3b82f6' : '#e5e7eb', backgroundColor: !accountPaymentToGeneral ? '#eff6ff' : 'transparent'}}>
                  <input
                    type="radio"
                    name="payment-destination"
                    checked={!accountPaymentToGeneral}
                    onChange={() => setAccountPaymentToGeneral(false)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">إضافة إلى عقد محدد</span>
                </label>
              </div>
            </div>

            {!accountPaymentToGeneral && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 block">العقد</label>
                <Select value={accountPaymentContract} onValueChange={setAccountPaymentContract}>
                  <SelectTrigger className="text-right">
                    <SelectValue placeholder="اختر عقدًا" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {contracts.map((ct)=> (
                      <SelectItem key={String(ct.Contract_Number)} value={String(ct.Contract_Number)}>
                        عقد رقم {String(ct.Contract_Number)} - {ct['Ad Type']}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Contract Details for Account Payment */}
            {!accountPaymentToGeneral && accountPaymentContract && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-green-600" />
                  <span className="font-semibold text-sm text-green-800">تفاصيل العقد</span>
                </div>
                {(() => {
                  const contractDetails = getContractDetails(accountPaymentContract);
                  if (!contractDetails) return null;
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">إجمالي العقد:</span>
                        <span className="font-semibold">{contractDetails.total.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">المدفوع:</span>
                        <span className="font-semibold text-green-600">{contractDetails.paid.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="text-gray-600">المتبقي:</span>
                        <span className={`font-bold ${contractDetails.remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {contractDetails.remaining.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">المبلغ</label>
              <Input 
                type="number" 
                value={accountPaymentAmount} 
                onChange={(e)=> setAccountPaymentAmount(e.target.value)}
                className="text-right"
                placeholder="أدخل المبلغ"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">طريقة الدفع</label>
              <Select value={accountPaymentMethod} onValueChange={setAccountPaymentMethod}>
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">المرجع</label>
              <Input 
                value={accountPaymentReference} 
                onChange={(e)=> setAccountPaymentReference(e.target.value)}
                className="text-right"
                placeholder="رقم المرجع (اختياري)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">التاريخ</label>
              <Input 
                type="date" 
                value={accountPaymentDate} 
                onChange={(e)=> setAccountPaymentDate(e.target.value)}
                className="text-right"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">ملاحظات</label>
              <Input 
                value={accountPaymentNotes} 
                onChange={(e)=> setAccountPaymentNotes(e.target.value)}
                className="text-right"
                placeholder="ملاحظات إضافية (اختياري)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={()=> setAccountPaymentOpen(false)} className="px-4">
                إلغاء
              </Button>
              <Button onClick={async () => {
                try {
                  if (!accountPaymentAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(accountPaymentAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  if (!accountPaymentToGeneral && !accountPaymentContract) {
                    toast.error('يرجى اختيار عقد');
                    return;
                  }
                  
                  const contractNumber = accountPaymentToGeneral ? null : 
                    (accountPaymentContract ? (isNaN(Number(accountPaymentContract)) ? null : Number(accountPaymentContract)) : null);
                  
                  const payload = {
                    customer_id: customerId || null,
                    customer_name: customerName,
                    contract_number: contractNumber,
                    amount: amt,
                    method: accountPaymentMethod || null,
                    reference: accountPaymentReference || null,
                    notes: accountPaymentNotes || null,
                    paid_at: accountPaymentDate ? new Date(accountPaymentDate).toISOString() : new Date().toISOString(),
                    entry_type: accountPaymentToGeneral ? 'account_payment' : 'receipt',
                  };
                  
                  console.log('Saving account payment with payload:', payload);
                  
                  const { error, data } = await supabase.from('customer_payments').insert(payload).select();
                  if (error) { 
                    console.error('Insert error:', error);
                    toast.error('فشل الحفظ: ' + error.message); 
                    return; 
                  }
                  
                  console.log('Account payment saved successfully:', data);
                  toast.success('تم الحفظ بنجاح');
                  setAccountPaymentOpen(false);
                  
                  // Reset form
                  setAccountPaymentAmount('');
                  setAccountPaymentMethod('');
                  setAccountPaymentReference('');
                  setAccountPaymentNotes('');
                  setAccountPaymentContract('');
                  setAccountPaymentToGeneral(true);
                  
                  await loadData();
                } catch (e) { 
                  console.error('Unexpected error:', e); 
                  toast.error('خطأ غير متوقع: ' + (e as Error).message); 
                }
              }} className="px-4 bg-green-600 hover:bg-green-700">
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Installation Invoice Dialog */}
      <Dialog open={printInstallationInvoiceOpen} onOpenChange={setPrintInstallationInvoiceOpen}>
        <DialogContent className="max-w-4xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">فاتورة طباعة وتركيب</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 mb-1">العميل:</div>
              <div className="font-semibold text-lg">{customerName}</div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 block">سبب الطباعة والتركيب</label>
              <Textarea 
                value={printInvoiceReason} 
                onChange={(e)=> setPrintInvoiceReason(e.target.value)}
                className="text-right min-h-[80px]"
                placeholder="اكتب سبب الطباعة والتركيب..."
              />
            </div>
            
            <div>
              <label className="text-sm font-semibold mb-3 block">اختر العقود الفعالة للطباعة:</label>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-3">
                {activeContracts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>اختيار</TableHead>
                        <TableHead>رقم العقد</TableHead>
                        <TableHead>نوع الإعلان</TableHead>
                        <TableHead>عدد اللوحات</TableHead>
                        <TableHead>عدد الوحدات للطباعة</TableHead>
                        <TableHead>سعر الوحدة</TableHead>
                        <TableHead>الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {printInvoiceItems.map((item, index) => (
                        <TableRow key={item.contractNumber}>
                          <TableCell>
                            <Checkbox
                              checked={item.selected}
                              onCheckedChange={(checked) => updatePrintInvoiceItem(index, 'selected', checked)}
                            />
                          </TableCell>
                          <TableCell>{item.contractNumber}</TableCell>
                          <TableCell>{item.adType}</TableCell>
                          <TableCell className="font-semibold text-blue-600">{item.numberOfBoards}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={item.units}
                              onChange={(e) => updatePrintInvoiceItem(index, 'units', Number(e.target.value) || 1)}
                              className="w-20"
                              disabled={!item.selected}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={item.pricePerUnit}
                              onChange={(e) => updatePrintInvoiceItem(index, 'pricePerUnit', Number(e.target.value) || 0)}
                              className="w-32"
                              disabled={!item.selected}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">
                            {item.total.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center text-muted-foreground py-6">
                    لا توجد عقود فعالة للعميل
                  </div>
                )}
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex justify-between items-center text-lg font-bold">
                <span>إجمالي الفاتورة:</span>
                <span className="text-green-600">
                  {printInvoiceItems.filter(item => item.selected).reduce((sum, item) => sum + item.total, 0).toLocaleString('ar-LY')} د.ل
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setPrintInstallationInvoiceOpen(false)}>إلغاء</Button>
              <Button onClick={printInstallationInvoice} className="bg-orange-600 hover:bg-orange-700">
                <Printer className="h-4 w-4 ml-2" />
                طباعة فاتورة الطباعة والتركيب
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Custom Invoice Dialog */}
      <Dialog open={printInvoiceOpen} onOpenChange={setPrintInvoiceOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>فاتورة طباعة مخصصة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">العميل: {customerName}</div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">تخصيص عناصر الفاتورة:</label>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>رقم العقد</TableHead>
                      <TableHead>نوع الإعلان</TableHead>
                      <TableHead>الكمية</TableHead>
                      <TableHead>سعر الوحدة</TableHead>
                      <TableHead>الإجمالي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceItems.map((item, index) => (
                      <TableRow key={item.contractNumber}>
                        <TableCell>{item.contractNumber}</TableCell>
                        <TableCell>{item.adType}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => updateInvoiceItem(index, 'quantity', Number(e.target.value) || 0)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) => updateInvoiceItem(index, 'unitPrice', Number(e.target.value) || 0)}
                            className="w-32"
                          />
                        </TableCell>
                        <TableCell className="font-semibold">
                          {item.total.toLocaleString('ar-LY')} د.ل
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-account-balance"
                checked={includeAccountBalance}
                onCheckedChange={setIncludeAccountBalance}
              />
              <label htmlFor="include-account-balance" className="text-sm cursor-pointer">
                إضافة رصيد الحساب العام ({accountPayments.toLocaleString('ar-LY')} د.ل)
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrintInvoiceOpen(false)}>إلغاء</Button>
              <Button onClick={printCustomInvoice} className="bg-blue-600 hover:bg-blue-700">
                <Printer className="h-4 w-4 ml-2" />
                طباعة الفاتورة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit receipt dialog */}
      <Dialog open={editReceiptOpen} onOpenChange={setEditReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>تعديل الإيصال</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input type="number" value={editReceiptAmount} onChange={(e)=> setEditReceiptAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">طريقة الدفع</label>
              <Select value={editReceiptMethod} onValueChange={setEditReceiptMethod}>
                <SelectTrigger><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المرجع</label>
              <Input value={editReceiptReference} onChange={(e)=> setEditReceiptReference(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ الدفع</label>
              <Input type="date" value={editReceiptDate} onChange={(e)=> setEditReceiptDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Input value={editReceiptNotes} onChange={(e)=> setEditReceiptNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setEditReceiptOpen(false)}>إلغاء</Button>
              <Button onClick={saveReceiptEdit}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add previous debt */}
      <Dialog open={addDebtOpen} onOpenChange={setAddDebtOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة دين سابق</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input type="number" value={debtAmount} onChange={(e)=> setDebtAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Input value={debtNotes} onChange={(e)=> setDebtNotes(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">التاريخ</label>
              <Input type="date" value={debtDate} onChange={(e)=> setDebtDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setAddDebtOpen(false)}>إلغاء</Button>
              <Button onClick={async () => {
                try {
                  if (!debtAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(debtAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  const payload = {
                    customer_id: customerId || null,
                    customer_name: customerName,
                    contract_number: null, // Debt is not tied to specific contract
                    amount: amt,
                    method: 'دين سابق',
                    reference: null,
                    notes: debtNotes || null,
                    paid_at: debtDate ? new Date(debtDate).toISOString() : new Date().toISOString(),
                    entry_type: 'debt',
                  };
                  
                  console.log('Saving debt with payload:', payload);
                  
                  const { error } = await supabase.from('customer_payments').insert(payload).select();
                  if (error) { 
                    console.error('Debt insert error:', error); 
                    toast.error('فشل الحفظ: ' + error.message); 
                    return; 
                  }
                  toast.success('تمت الإضافة');
                  setAddDebtOpen(false);
                  
                  // Reset form
                  setDebtAmount('');
                  setDebtNotes('');
                  
                  await loadData();
                } catch (e) { 
                  console.error('Debt save error:', e); 
                  toast.error('خطأ غير متوقع: ' + (e as Error).message); 
                }
              }}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}