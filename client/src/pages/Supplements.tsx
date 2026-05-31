import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { trpc } from "@/lib/trpc";
import { useIsOwner } from "@/contexts/OwnerContext";
import { toast } from "sonner";
import { todayHKString, formatHKDate } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pill, Trash2, Edit2, Loader2, ArrowUpDown, AlertTriangle, Package, RefreshCw, Download, ShoppingCart, History, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";

const CATEGORIES = ['protein', 'vitamin', 'mineral', 'omega3', 'pre_workout', 'post_workout', 'probiotic', 'collagen', 'creatine', 'bcaa', 'electrolyte', 'antioxidant', 'joint', 'liver', 'hormone', 'adaptogen', 'nmn', 'amino_acid', 'diuretic', 'other'] as const;
const TIME_OF_DAY = ['morning', 'afternoon', 'evening', 'night', 'pre_workout', 'post_workout', 'with_meal'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  protein: 'bg-blue-500/20 text-blue-400',
  vitamin: 'bg-yellow-500/20 text-yellow-400',
  mineral: 'bg-green-500/20 text-green-400',
  omega3: 'bg-cyan-500/20 text-cyan-400',
  pre_workout: 'bg-red-500/20 text-red-400',
  post_workout: 'bg-orange-500/20 text-orange-400',
  probiotic: 'bg-purple-500/20 text-purple-400',
  collagen: 'bg-pink-500/20 text-pink-400',
  creatine: 'bg-indigo-500/20 text-indigo-400',
  bcaa: 'bg-teal-500/20 text-teal-400',
  electrolyte: 'bg-sky-500/20 text-sky-400',
  antioxidant: 'bg-amber-500/20 text-amber-400',
  joint: 'bg-lime-500/20 text-lime-400',
  liver: 'bg-emerald-500/20 text-emerald-400',
  hormone: 'bg-rose-500/20 text-rose-400',
  adaptogen: 'bg-violet-500/20 text-violet-400',
  nmn: 'bg-fuchsia-500/20 text-fuchsia-400',
  amino_acid: 'bg-orange-500/20 text-orange-400',
  diuretic: 'bg-blue-400/20 text-blue-300',
  other: 'bg-muted text-muted-foreground',
};

const defaultSupplementForm = { name: '', brand: '', category: 'vitamin', servingSize: '', currentStock: '', lowStockThreshold: '30', purchaseDate: '', expiryDate: '', notes: '', isActive: true, reminderEnabled: false, reminderTime: '08:00' };
const defaultLogForm = { supplementId: '', date: todayHKString(), quantity: '1', timeOfDay: 'morning', notes: '' };
const defaultRestockForm = { supplementId: '', quantity: '' };
const defaultPurchaseForm = { supplementId: '', purchaseDate: '', quantity: '', unitPrice: '', totalPrice: '', currency: 'USD', source: 'iHerb', orderNo: '', notes: '', addToStock: true };

export default function Supplements() {
  const { t } = useTranslation();
  const isOwner = useIsOwner();
  const [showSupplementDialog, setShowSupplementDialog] = useState(false);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [editSupplement, setEditSupplement] = useState<any>(null);
  const [supplementForm, setSupplementForm] = useState<any>(defaultSupplementForm);
  const [logForm, setLogForm] = useState<any>(defaultLogForm);
  const [restockForm, setRestockForm] = useState<any>(defaultRestockForm);
  const [sort, setSort] = useState<'name' | 'stock_asc' | 'stock_desc' | 'category' | 'expiry'>('name');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [logSort, setLogSort] = useState<'date_desc' | 'date_asc' | 'qty_desc'>('date_desc');
  const [logSearch, setLogSearch] = useState('');
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [editPurchase, setEditPurchase] = useState<any>(null);
  const [editLog, setEditLog] = useState<any>(null);
  const [purchaseForm, setPurchaseForm] = useState<any>(defaultPurchaseForm);
  const [purchaseFilter, setPurchaseFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [analyticsView, setAnalyticsView] = useState<'monthly' | 'yearly'>('monthly');
  const [analyticsGroup, setAnalyticsGroup] = useState<'brand' | 'category'>('brand');

  const utils = trpc.useUtils();
  const { data: supplements = [], isLoading } = trpc.supplements.getAll.useQuery();
  const { data: logs = [] } = trpc.supplements.getLogs.useQuery({ limit: 200 });
  const { data: purchases = [] } = trpc.supplements.getPurchases.useQuery({ supplementId: undefined });
  const { data: stockHistory = [] } = trpc.supplements.getStockHistory.useQuery({ limit: 300 });

  const addSupplement = trpc.supplements.add.useMutation({
    onSuccess: () => { utils.supplements.getAll.invalidate(); toast.success(t('supplements.added')); setShowSupplementDialog(false); setSupplementForm(defaultSupplementForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateSupplement = trpc.supplements.update.useMutation({
    onSuccess: () => { utils.supplements.getAll.invalidate(); toast.success(t('common.updated')); setShowSupplementDialog(false); setEditSupplement(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSupplement = trpc.supplements.delete.useMutation({
    onSuccess: () => { utils.supplements.getAll.invalidate(); toast.success(t('common.deleted')); },
    onError: (e) => toast.error(e.message),
  });
  const addLog = trpc.supplements.addLog.useMutation({
    onSuccess: () => { utils.supplements.getLogs.invalidate(); utils.supplements.getAll.invalidate(); toast.success(t('supplements.intake_logged')); setShowLogDialog(false); setLogForm(defaultLogForm); },
    onError: (e) => toast.error(e.message),
  });
  const deleteLog = trpc.supplements.deleteLog.useMutation({
    onSuccess: () => { utils.supplements.getLogs.invalidate(); utils.supplements.getAll.invalidate(); utils.supplements.getStockHistory.invalidate(); toast.success(t('common.deleted')); },
    onError: (e) => toast.error(e.message),
  });
  const updateLog = trpc.supplements.updateLog.useMutation({
    onSuccess: () => { utils.supplements.getLogs.invalidate(); utils.supplements.getAll.invalidate(); utils.supplements.getStockHistory.invalidate(); toast.success(t('common.updated')); setEditLog(null); },
    onError: (e) => toast.error(e.message),
  });
  const restock = trpc.supplements.restockSupplement.useMutation({
    onSuccess: () => { utils.supplements.getAll.invalidate(); utils.supplements.getStockHistory.invalidate(); toast.success(t('supplements.restocked')); setShowRestockDialog(false); setRestockForm(defaultRestockForm); },
    onError: (e) => toast.error(e.message),
  });
  const addPurchase = trpc.supplements.addPurchase.useMutation({
    onSuccess: () => { utils.supplements.getPurchases.invalidate(); utils.supplements.getAll.invalidate(); utils.supplements.getStockHistory.invalidate(); toast.success(t('supplements.purchase_added')); setShowPurchaseDialog(false); setPurchaseForm(defaultPurchaseForm); },
    onError: (e) => toast.error(e.message),
  });
  const updatePurchase = trpc.supplements.updatePurchase.useMutation({
    onSuccess: () => { utils.supplements.getPurchases.invalidate(); toast.success(t('supplements.purchase_updated')); setShowPurchaseDialog(false); setEditPurchase(null); },
    onError: (e) => toast.error(e.message),
  });
  const deletePurchase = trpc.supplements.deletePurchase.useMutation({
    onSuccess: () => { utils.supplements.getPurchases.invalidate(); toast.success(t('supplements.purchase_deleted')); },
    onError: (e) => toast.error(e.message),
  });
  const bulkLogToday = trpc.supplements.bulkLogToday.useMutation({
    onSuccess: (res) => {
      utils.supplements.getLogs.invalidate();
      utils.supplements.getAll.invalidate();
      utils.supplements.getStockHistory.invalidate();
      if (res.skipped > 0) toast.success(`已記錄 ${res.logged} 項，${res.skipped} 項已跳過`);
      else toast.success(`已一鍵記錄 ${res.logged} 項補充品`);
    },
    onError: (e) => toast.error(e.message),
  });
  const backfillStockHistory = trpc.supplements.backfillStockHistory.useMutation({
    onSuccess: (res) => {
      utils.supplements.getStockHistory.invalidate();
      toast.success(`回填完成：新增 ${res.inserted} 筆庫存記錄`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Toggle card expansion
  const toggleCard = (id: number) => setExpandedCards(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // Filtered purchases
  const displayPurchases = useMemo(() => {
    let list = [...purchases];
    if (purchaseFilter !== 'all') list = list.filter((p: any) => p.supplementId === Number(purchaseFilter));
    return list;
  }, [purchases, purchaseFilter]);

  // Filtered stock history
  const displayStockHistory = useMemo(() => {
    let list = [...stockHistory];
    if (stockFilter !== 'all') list = list.filter((h: any) => h.supplementId === Number(stockFilter));
    return list;
  }, [stockHistory, stockFilter]);

  // Low stock alerts
  const lowStock = supplements.filter((s: any) => s.isActive && (s.currentStock ?? 0) <= (s.lowStockThreshold ?? 30));

  // Sorted/filtered supplements
  const displaySupplements = useMemo(() => {
    let list = [...supplements];
    if (categoryFilter !== 'all') list = list.filter((s: any) => s.category === categoryFilter);
    switch (sort) {
      case 'name': list.sort((a: any, b: any) => a.name.localeCompare(b.name)); break;
      case 'stock_asc': list.sort((a: any, b: any) => (a.currentStock ?? 0) - (b.currentStock ?? 0)); break;
      case 'stock_desc': list.sort((a: any, b: any) => (b.currentStock ?? 0) - (a.currentStock ?? 0)); break;
      case 'category': list.sort((a: any, b: any) => (a.category || '').localeCompare(b.category || '')); break;
      case 'expiry': list.sort((a: any, b: any) => {
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
      }); break;
    }
    return list;
  }, [supplements, sort, categoryFilter]);

  // Sorted/filtered logs
  const displayLogs = useMemo(() => {
    let list = [...logs];
    if (logSearch.trim()) {
      const suppMap = new Map(supplements.map((s: any) => [s.id, s.name]));
      list = list.filter((l: any) => (suppMap.get(l.supplementId) || '').toLowerCase().includes(logSearch.toLowerCase()) || (l.notes || '').toLowerCase().includes(logSearch.toLowerCase()));
    }
    switch (logSort) {
      case 'date_asc': list.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()); break;
      case 'date_desc': list.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()); break;
      case 'qty_desc': list.sort((a: any, b: any) => (b.quantity ?? 0) - (a.quantity ?? 0)); break;
    }
    return list;
  }, [logs, logSort, logSearch, supplements]);

  const suppMap = useMemo(() => new Map(supplements.map((s: any) => [s.id, s])), [supplements]);

  // Purchase analytics
  const purchaseAnalytics = useMemo(() => {
    const today = new Date();
    const grouped: Record<string, number> = {};
    let thisMonth = 0, thisYear = 0, allTime = 0;

    purchases.forEach((p: any) => {
      const total = parseFloat(p.totalPrice ?? '0') || 0;
      const date = new Date(p.purchaseDate);
      const key = analyticsGroup === 'brand'
        ? (suppMap.get(p.supplementId)?.brand ?? 'Unknown')
        : t(`supplements.cat_${suppMap.get(p.supplementId)?.category ?? 'other'}`);
      const periodKey = analyticsView === 'monthly'
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        : String(date.getFullYear());
      const chartKey = `${periodKey}|${key}`;
      grouped[chartKey] = (grouped[chartKey] ?? 0) + total;
      allTime += total;
      if (date.getFullYear() === today.getFullYear()) {
        thisYear += total;
        if (date.getMonth() === today.getMonth()) thisMonth += total;
      }
    });

    // Build chart data: group by period, stack by brand/category
    const periodMap: Record<string, Record<string, number>> = {};
    Object.entries(grouped).forEach(([k, v]) => {
      const [period, label] = k.split('|');
      if (!periodMap[period]) periodMap[period] = {};
      periodMap[period][label] = (periodMap[period][label] ?? 0) + v;
    });
    const periods = Object.keys(periodMap).sort();
    const allLabels = Array.from(new Set(Object.values(periodMap).flatMap(m => Object.keys(m))));
    const chartData = periods.map(period => ({ period, ...periodMap[period] }));

    return { chartData, allLabels, thisMonth, thisYear, allTime };
  }, [purchases, analyticsView, analyticsGroup, suppMap, t]);

  // Today's schedule: active supplements grouped by time_of_day
  const todaySchedule = useMemo(() => {
    const today = todayHKString();
    const takenToday = new Set(logs.filter((l: any) => l.date === today).map((l: any) => l.supplementId));
    const active = supplements.filter((s: any) => s.isActive);
    const groups: Record<string, any[]> = {};
    TIME_OF_DAY.forEach(t => { groups[t] = []; });
    groups['other'] = [];
    active.forEach((s: any) => {
      const tod = s.timeOfDay ?? 'morning';
      if (groups[tod]) groups[tod].push({ ...s, takenToday: takenToday.has(s.id) });
      else groups['other'].push({ ...s, takenToday: takenToday.has(s.id) });
    });
    const totalActive = active.length;
    const totalTaken = active.filter((s: any) => takenToday.has(s.id)).length;
    return { groups, totalActive, totalTaken };
  }, [supplements, logs]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Pill className="w-6 h-6 text-primary" />
            {t('supplements.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('supplements.subtitle')}</p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowLogDialog(true); setLogForm(defaultLogForm); }} className="gap-2 text-sm">
              <Plus className="w-4 h-4" /> {t('supplements.log_intake')}
            </Button>
            <Button onClick={() => { setEditSupplement(null); setSupplementForm(defaultSupplementForm); setShowSupplementDialog(true); }} className="gap-2 text-sm">
              <Plus className="w-4 h-4" /> {t('supplements.add')}
            </Button>
          </div>
        )}
      </div>

      {/* Low stock alerts */}
      {lowStock.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-yellow-400">{t('supplements.low_stock_alert')} ({lowStock.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-1.5">
                <span className="text-xs font-medium text-foreground">{s.name}</span>
                <span className="text-xs text-yellow-400">{s.currentStock ?? 0} {t('supplements.units_left')}</span>
                <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => { setRestockForm({ supplementId: String(s.id), quantity: '' }); setShowRestockDialog(true); }}>
                  <RefreshCw className="w-3 h-3 text-yellow-400" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <Package className="w-5 h-5 text-primary" />
          <div><p className="text-xl font-bold text-foreground">{supplements.filter((s: any) => s.isActive).length}</p><p className="text-xs text-muted-foreground">{t('supplements.active')}</p></div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <div><p className="text-xl font-bold text-yellow-400">{lowStock.length}</p><p className="text-xs text-muted-foreground">{t('supplements.low_stock')}</p></div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <Pill className="w-5 h-5 text-green-400" />
          <div><p className="text-xl font-bold text-foreground">{logs.filter((l: any) => l.date === todayHKString()).length}</p><p className="text-xs text-muted-foreground">{t('supplements.today_taken')}</p></div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <Pill className="w-5 h-5 text-blue-400" />
          <div><p className="text-xl font-bold text-foreground">{logs.filter((l: any) => l.date >= new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).length}</p><p className="text-xs text-muted-foreground">{t('supplements.week_intakes')}</p></div>
        </div>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="inventory">{t('supplements.inventory')}</TabsTrigger>
          <TabsTrigger value="log">{t('supplements.intake_log')}</TabsTrigger>
          <TabsTrigger value="purchases" className="gap-1"><ShoppingCart className="w-3 h-3" />{t('supplements.purchases')}</TabsTrigger>
          <TabsTrigger value="stock" className="gap-1"><History className="w-3 h-3" />{t('supplements.stock_history')}</TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1">📋 {t('supplements.today_schedule')}</TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all_categories')}</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`supplements.cat_${c}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={v => setSort(v as any)}>
              <SelectTrigger className="h-8 w-44 text-xs"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">{t('supplements.sort_name')}</SelectItem>
                <SelectItem value="stock_asc">{t('supplements.sort_stock_asc')}</SelectItem>
                <SelectItem value="stock_desc">{t('supplements.sort_stock_desc')}</SelectItem>
                <SelectItem value="category">{t('supplements.sort_category')}</SelectItem>
                <SelectItem value="expiry">{t('supplements.sort_expiry')}</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">{displaySupplements.length} {t('common.items')}</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : displaySupplements.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Pill className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('supplements.no_supplements')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displaySupplements.map((s: any) => {
                const isLow = (s.currentStock ?? 0) <= (s.lowStockThreshold ?? 30);
                const stockPct = Math.min((s.currentStock ?? 0) / Math.max(s.lowStockThreshold * 3, 90), 1);
                return (
                  <div key={s.id} className={`bg-card border rounded-2xl p-4 ${isLow ? 'border-yellow-500/40' : 'border-border'}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground text-sm">{s.name}</h3>
                          {!s.isActive && <Badge variant="outline" className="text-xs">{t('supplements.inactive')}</Badge>}
                        </div>
                        {s.brand && <p className="text-xs text-muted-foreground">{s.brand}</p>}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[s.category] || CATEGORY_COLORS.other}`}>
                            {t(`supplements.cat_${s.category}`)}
                          </span>
                          {s.iherbUrl && (
                            <a href={s.iherbUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-0.5 hover:underline">
                              <ExternalLink className="w-3 h-3" /> iHerb
                            </a>
                          )}
                        </div>
                      </div>
                      {isOwner && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => {
                            setEditSupplement(s);
                            setSupplementForm({ name: s.name, brand: s.brand || '', category: s.category || 'vitamin', servingSize: s.servingSize || '', currentStock: s.currentStock ?? '', lowStockThreshold: s.lowStockThreshold ?? 30, purchaseDate: s.purchaseDate || '', expiryDate: s.expiryDate || '', notes: s.notes || '', isActive: s.isActive ?? true, reminderEnabled: s.reminderEnabled ?? false, reminderTime: s.reminderTime || '08:00' });
                            setShowSupplementDialog(true);
                          }}><Edit2 className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive" onClick={() => deleteSupplement.mutate({ id: s.id })}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      )}
                    </div>

                    {/* Stock bar */}
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{t('supplements.stock')}</span>
                        <span className={`font-semibold ${isLow ? 'text-yellow-400' : 'text-foreground'}`}>
                          {s.currentStock ?? 0} {t('supplements.units')}
                          {isLow && <AlertTriangle className="w-3 h-3 inline ml-1 text-yellow-400" />}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isLow ? 'bg-yellow-400' : 'bg-primary'}`} style={{ width: `${stockPct * 100}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">{t('supplements.alert_at')}: {s.lowStockThreshold ?? 30}</p>
                    </div>

                    {/* Meta */}
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {s.servingSize && <p>{t('supplements.serving')}: {s.servingSize}</p>}
                      {s.dailyDose && <p>{t('supplements.daily_dose')}: {s.dailyDose} {t('supplements.units')}</p>}
                      {s.expiryDate && <p className={new Date(s.expiryDate) < new Date() ? 'text-red-400' : ''}>{t('supplements.expiry')}: {formatHKDate(s.expiryDate)}</p>}
                    </div>
                    {/* Description expand */}
                    {s.description && (
                      <div className="mt-2">
                        <button onClick={() => toggleCard(s.id)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          {expandedCards.has(s.id) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {t('supplements.description')}
                        </button>
                        {expandedCards.has(s.id) && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed border-t border-border pt-2">{s.description}</p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {isOwner && (
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => { setLogForm({ ...defaultLogForm, supplementId: String(s.id) }); setShowLogDialog(true); }}>
                          <Plus className="w-3 h-3" /> {t('supplements.log_intake')}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setRestockForm({ supplementId: String(s.id), quantity: '' }); setShowRestockDialog(true); }}>
                          <RefreshCw className="w-3 h-3" /> {t('supplements.restock')}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Intake Log Tab */}
        <TabsContent value="log" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder={t('common.search') + '...'} value={logSearch} onChange={e => setLogSearch(e.target.value)} className="h-8 text-xs w-40" />
            <Select value={logSort} onValueChange={v => setLogSort(v as any)}>
              <SelectTrigger className="h-8 w-44 text-xs"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">{t('common.sort_date_desc')}</SelectItem>
                <SelectItem value="date_asc">{t('common.sort_date_asc')}</SelectItem>
                <SelectItem value="qty_desc">{t('supplements.sort_qty_desc')}</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{displayLogs.length} {t('common.records')}</span>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.open('/api/export/supplements/csv', '_blank')}>
                <Download className="w-3 h-3" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.open('/api/export/supplements/pdf', '_blank')}>
                <Download className="w-3 h-3" /> PDF
              </Button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[t('common.date'), t('supplements.supplement'), t('supplements.quantity'), t('supplements.time_of_day'), t('common.notes'), ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayLogs.map((l: any) => {
                    const supp = suppMap.get(l.supplementId);
                    return (
                      <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium whitespace-nowrap">{formatHKDate(l.date)}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground text-sm">{supp?.name ?? `#${l.supplementId}`}</p>
                            {supp?.brand && <p className="text-xs text-muted-foreground">{supp.brand}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3">{l.quantity ?? 1} {t('supplements.units')}</td>
                        <td className="px-4 py-3">{l.timeOfDay ? t(`supplements.time_${l.timeOfDay}`) : '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-32 truncate">{l.notes ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setEditLog({ ...l, _originalQuantity: l.quantity ?? 1 })}>
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteLog.mutate({ id: l.id, quantity: l.quantity ?? 1, supplementId: l.supplementId })}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {displayLogs.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">{t('common.no_records')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Purchase Records Tab */}
        <TabsContent value="purchases" className="mt-4 space-y-4">

          {/* Analytics Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('supplements.spend_this_month')}</p>
              <p className="text-xl font-bold text-primary">USD {purchaseAnalytics.thisMonth.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('supplements.spend_this_year')}</p>
              <p className="text-xl font-bold text-foreground">USD {purchaseAnalytics.thisYear.toFixed(2)}</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{t('supplements.spend_all_time')}</p>
              <p className="text-xl font-bold text-foreground">USD {purchaseAnalytics.allTime.toFixed(2)}</p>
            </div>
          </div>

          {/* Analytics Chart */}
          {purchaseAnalytics.chartData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{t('supplements.spend_chart')}</h3>
                <div className="flex gap-2">
                  <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                    <button onClick={() => setAnalyticsView('monthly')} className={`px-3 py-1 transition-colors ${analyticsView === 'monthly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('supplements.monthly')}</button>
                    <button onClick={() => setAnalyticsView('yearly')} className={`px-3 py-1 transition-colors ${analyticsView === 'yearly' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('supplements.yearly')}</button>
                  </div>
                  <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                    <button onClick={() => setAnalyticsGroup('brand')} className={`px-3 py-1 transition-colors ${analyticsGroup === 'brand' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('supplements.by_brand')}</button>
                    <button onClick={() => setAnalyticsGroup('category')} className={`px-3 py-1 transition-colors ${analyticsGroup === 'category' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{t('supplements.by_category')}</button>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={purchaseAnalytics.chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v: any, name: string) => [`USD ${Number(v).toFixed(2)}`, name]} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                  {purchaseAnalytics.allLabels.map((label, i) => (
                    <Bar key={label} dataKey={label} stackId="a" fill={`hsl(${(i * 47) % 360}, 60%, 55%)`} radius={i === purchaseAnalytics.allLabels.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-wrap gap-2 mt-2">
                {purchaseAnalytics.allLabels.map((label, i) => (
                  <div key={label} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: `hsl(${(i * 47) % 360}, 60%, 55%)` }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Select value={purchaseFilter} onValueChange={setPurchaseFilter}>
              <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {supplements.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{displayPurchases.length} {t('common.records')}</span>
            {isOwner && (
              <Button className="ml-auto gap-1 h-8 text-xs" onClick={() => { setEditPurchase(null); setPurchaseForm(defaultPurchaseForm); setShowPurchaseDialog(true); }}>
                <Plus className="w-3 h-3" /> {t('supplements.add_purchase')}
              </Button>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[t('common.date'), t('supplements.supplement'), t('supplements.quantity'), t('supplements.unit_price'), t('supplements.total_price'), t('supplements.source'), t('supplements.order_no'), ''].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayPurchases.map((p: any) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{formatHKDate(p.purchaseDate)}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground text-sm">{p.supplementName ?? `#${p.supplementId}`}</p>
                          {p.supplementBrand && <p className="text-xs text-muted-foreground">{p.supplementBrand}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">{p.quantity} {t('supplements.units')}</td>
                      <td className="px-4 py-3">{p.unitPrice ? `${p.currency ?? 'USD'} ${p.unitPrice}` : '—'}</td>
                      <td className="px-4 py-3">{p.totalPrice ? `${p.currency ?? 'USD'} ${p.totalPrice}` : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.source ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.orderNo ?? '—'}</td>
                      {isOwner && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setEditPurchase(p); setPurchaseForm({ supplementId: String(p.supplementId), purchaseDate: p.purchaseDate, quantity: String(p.quantity), unitPrice: p.unitPrice ?? '', totalPrice: p.totalPrice ?? '', currency: p.currency ?? 'USD', source: p.source ?? 'iHerb', orderNo: p.orderNo ?? '', notes: p.notes ?? '', addToStock: false }); setShowPurchaseDialog(true); }}><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deletePurchase.mutate({ id: p.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                      )}
                    </tr>
                  ))}
                  {displayPurchases.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">{t('supplements.no_purchases')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Stock History Tab */}
        <TabsContent value="stock" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {supplements.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{displayStockHistory.length} {t('common.records')}</span>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={backfillStockHistory.isPending}
                onClick={() => backfillStockHistory.mutate()}
              >
                {backfillStockHistory.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                回填歷史記錄
              </Button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {[t('common.date'), t('supplements.supplement'), t('supplements.adjust_type'), t('supplements.delta'), t('supplements.stock_after'), t('supplements.reason')].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 text-xs text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayStockHistory.map((h: any) => (
                    <tr key={h.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{formatHKDate(h.adjustDate)}</td>
                      <td className="px-4 py-3 text-sm">{h.supplementName ?? `#${h.supplementId}`}</td>
                      <td className="px-4 py-3">
                        {(() => {
                          const typeColors: Record<string, string> = {
                            intake: 'bg-red-500/15 text-red-400 border-red-500/30',
                            intake_reversal: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
                            intake_edit: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
                            restock: 'bg-green-500/15 text-green-400 border-green-500/30',
                            purchase: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                            manual: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                            adjustment: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                            expiry: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
                          };
                          const typeLabels: Record<string, string> = {
                            intake: '進食',
                            intake_reversal: '還原',
                            intake_edit: '修改',
                            restock: '補貨',
                            purchase: '購買',
                            manual: '手動',
                            adjustment: '調整',
                            expiry: '過期',
                          };
                          const cls = typeColors[h.adjustType] ?? 'bg-muted text-muted-foreground border-border';
                          const label = typeLabels[h.adjustType] ?? h.adjustType;
                          return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>{label}</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={h.delta >= 0 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                          {h.delta >= 0 ? '+' : ''}{h.delta}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{h.stockAfter}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{h.reason ?? '—'}</td>
                    </tr>
                  ))}
                  {displayStockHistory.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">{t('supplements.no_stock_history')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Today's Schedule Tab */}
        <TabsContent value="schedule" className="mt-4 space-y-4">
          {/* Progress bar */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">{t('supplements.today_progress')}</h3>
              <span className="text-sm font-bold text-primary">{todaySchedule.totalTaken} / {todaySchedule.totalActive}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: todaySchedule.totalActive > 0 ? `${(todaySchedule.totalTaken / todaySchedule.totalActive) * 100}%` : '0%' }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('supplements.today_date')}: {todayHKString()}</p>
          </div>

          {/* Groups by time of day */}
          {([
            { key: 'morning', label: t('supplements.tod_morning'), icon: '🌅' },
            { key: 'with_meal', label: t('supplements.tod_with_meal'), icon: '🍽️' },
            { key: 'afternoon', label: t('supplements.tod_afternoon'), icon: '☀️' },
            { key: 'pre_workout', label: t('supplements.tod_pre_workout'), icon: '💪' },
            { key: 'post_workout', label: t('supplements.tod_post_workout'), icon: '🏋️' },
            { key: 'evening', label: t('supplements.tod_evening'), icon: '🌆' },
            { key: 'night', label: t('supplements.tod_night'), icon: '🌙' },
            { key: 'other', label: t('supplements.tod_other'), icon: '💊' },
          ] as const).map(({ key, label, icon }) => {
            const items = todaySchedule.groups[key] ?? [];
            if (items.length === 0) return null;
            return (
              <div key={key} className="bg-card border border-border rounded-2xl p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <span>{icon}</span> {label}
                  <span className="ml-auto text-xs text-muted-foreground">{items.filter((i: any) => i.takenToday).length}/{items.length}</span>
                </h3>
                <div className="space-y-2">
                  {items.map((s: any) => (
                    <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${s.takenToday ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/30 border-border'}`}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${s.takenToday ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.brand} · {s.dailyDose ?? 1} {t('supplements.units')}</p>
                      </div>
                      {s.takenToday ? (
                        <span className="text-green-400 text-xs font-medium flex items-center gap-1">✓ {t('supplements.taken')}</span>
                      ) : (
                        <Button size="sm" className="h-7 text-xs px-3" onClick={() => {
                          addLog.mutate({ supplementId: s.id, date: todayHKString(), quantity: s.dailyDose ?? 1, timeOfDay: key === 'other' ? 'morning' : key as any, notes: '' });
                        }} disabled={addLog.isPending}>
                          {addLog.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : t('supplements.mark_taken')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Bulk log button */}
          {todaySchedule.totalActive > 0 && todaySchedule.totalTaken < todaySchedule.totalActive && (
            <div className="flex justify-end">
              <Button
                size="sm"
                className="gap-2 text-sm"
                disabled={bulkLogToday.isPending}
                onClick={() => {
                  const unlogged = Object.entries(todaySchedule.groups)
                    .flatMap(([timeKey, items]: [string, any]) =>
                      (items as any[]).filter((s: any) => !s.takenToday).map((s: any) => ({
                        supplementId: s.id,
                        quantity: s.dailyDose ?? 1,
                        timeOfDay: timeKey === 'other' ? 'morning' : timeKey,
                      }))
                    );
                  if (unlogged.length === 0) return;
                  bulkLogToday.mutate({ date: todayHKString(), items: unlogged });
                }}
              >
                {bulkLogToday.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                一鍵全部記錄
              </Button>
            </div>
          )}

          {todaySchedule.totalActive === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Pill className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('supplements.no_active_supplements')}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Supplement Dialog */}
      <Dialog open={showSupplementDialog} onOpenChange={setShowSupplementDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editSupplement ? t('supplements.edit') : t('supplements.add')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.name')} *</label>
              <Input placeholder="e.g. Vitamin D3" value={supplementForm.name} onChange={e => setSupplementForm((f: any) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.brand')}</label>
                <Input placeholder="e.g. NOW Foods" value={supplementForm.brand} onChange={e => setSupplementForm((f: any) => ({ ...f, brand: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.category')}</label>
                <Select value={supplementForm.category} onValueChange={v => setSupplementForm((f: any) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`supplements.cat_${c}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.serving_size')}</label>
                <Input placeholder="e.g. 1 capsule / 30g" value={supplementForm.servingSize} onChange={e => setSupplementForm((f: any) => ({ ...f, servingSize: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.current_stock')}</label>
                <Input type="number" min="0" placeholder="e.g. 90" value={supplementForm.currentStock} onChange={e => setSupplementForm((f: any) => ({ ...f, currentStock: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.low_stock_threshold')} ({t('supplements.units')})</label>
              <Input type="number" min="0" placeholder="30" value={supplementForm.lowStockThreshold} onChange={e => setSupplementForm((f: any) => ({ ...f, lowStockThreshold: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.purchase_date')}</label>
                <Input type="date" value={supplementForm.purchaseDate} onChange={e => setSupplementForm((f: any) => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.expiry_date')}</label>
                <Input type="date" value={supplementForm.expiryDate} onChange={e => setSupplementForm((f: any) => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('common.notes')}</label>
              <Textarea placeholder={t('common.optional_notes')} value={supplementForm.notes} onChange={e => setSupplementForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            {/* Reminder settings */}
            <div className="border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Daily Reminder</p>
                  <p className="text-xs text-muted-foreground">Get notified when you haven't taken this supplement today</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSupplementForm((f: any) => ({ ...f, reminderEnabled: !f.reminderEnabled }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    supplementForm.reminderEnabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    supplementForm.reminderEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
              {supplementForm.reminderEnabled && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Reminder Time (HKT)</label>
                  <Input type="time" value={supplementForm.reminderTime} onChange={e => setSupplementForm((f: any) => ({ ...f, reminderTime: e.target.value }))} className="h-8 text-xs w-32" />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSupplementDialog(false); setEditSupplement(null); }}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              if (!supplementForm.name.trim()) { toast.error(t('supplements.name_required')); return; }
              const payload = { ...supplementForm, currentStock: supplementForm.currentStock ? Number(supplementForm.currentStock) : undefined, lowStockThreshold: supplementForm.lowStockThreshold ? Number(supplementForm.lowStockThreshold) : 30, purchaseDate: supplementForm.purchaseDate || undefined, expiryDate: supplementForm.expiryDate || undefined };
              if (editSupplement) updateSupplement.mutate({ id: editSupplement.id, ...payload });
              else addSupplement.mutate(payload);
            }} disabled={addSupplement.isPending || updateSupplement.isPending}>
              {(addSupplement.isPending || updateSupplement.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Intake Dialog */}
      {/* Edit Log Dialog */}
      <Dialog open={!!editLog} onOpenChange={open => { if (!open) setEditLog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('supplements.edit_intake', { defaultValue: '修改進食記錄' })}</DialogTitle></DialogHeader>
          {editLog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('common.date')}</label>
                  <Input type="date" value={editLog.date} onChange={e => setEditLog((f: any) => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.quantity')}</label>
                  <Input type="number" min="1" value={editLog.quantity ?? 1} onChange={e => setEditLog((f: any) => ({ ...f, quantity: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.time_of_day')}</label>
                <Select value={editLog.timeOfDay ?? ''} onValueChange={v => setEditLog((f: any) => ({ ...f, timeOfDay: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIME_OF_DAY.map(t2 => <SelectItem key={t2} value={t2}>{t(`supplements.time_${t2}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('common.notes')}</label>
                <Input placeholder={t('common.optional_notes')} value={editLog.notes ?? ''} onChange={e => setEditLog((f: any) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLog(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              if (!editLog) return;
              updateLog.mutate({
                id: editLog.id,
                supplementId: editLog.supplementId,
                date: editLog.date,
                quantity: Number(editLog.quantity) || 1,
                timeOfDay: editLog.timeOfDay,
                notes: editLog.notes || undefined,
                oldQuantity: editLog._originalQuantity ?? editLog.quantity,
              });
            }} disabled={updateLog.isPending}>
              {updateLog.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('supplements.log_intake')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.supplement')} *</label>
              <Select value={logForm.supplementId} onValueChange={v => setLogForm((f: any) => ({ ...f, supplementId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('supplements.select_supplement')} /></SelectTrigger>
                <SelectContent>{supplements.filter((s: any) => s.isActive).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}{s.brand ? ` (${s.brand})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('common.date')}</label>
                <Input type="date" value={logForm.date} onChange={e => setLogForm((f: any) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.quantity')}</label>
                <Input type="number" min="1" value={logForm.quantity} onChange={e => setLogForm((f: any) => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.time_of_day')}</label>
              <Select value={logForm.timeOfDay} onValueChange={v => setLogForm((f: any) => ({ ...f, timeOfDay: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIME_OF_DAY.map(t2 => <SelectItem key={t2} value={t2}>{t(`supplements.time_${t2}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('common.notes')}</label>
              <Input placeholder={t('common.optional_notes')} value={logForm.notes} onChange={e => setLogForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              if (!logForm.supplementId) { toast.error(t('supplements.select_supplement')); return; }
              addLog.mutate({ supplementId: Number(logForm.supplementId), date: logForm.date, quantity: Number(logForm.quantity) || 1, timeOfDay: logForm.timeOfDay, notes: logForm.notes || undefined });
            }} disabled={addLog.isPending}>
              {addLog.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editPurchase ? t('supplements.edit_purchase') : t('supplements.add_purchase')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.supplement')} *</label>
              <Select value={purchaseForm.supplementId} onValueChange={v => setPurchaseForm((f: any) => ({ ...f, supplementId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('supplements.select_supplement')} /></SelectTrigger>
                <SelectContent>{supplements.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}{s.brand ? ` (${s.brand})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('common.date')} *</label>
                <Input type="date" value={purchaseForm.purchaseDate} onChange={e => setPurchaseForm((f: any) => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.quantity')} *</label>
                <Input type="number" min="1" placeholder="90" value={purchaseForm.quantity} onChange={e => setPurchaseForm((f: any) => ({ ...f, quantity: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.currency')}</label>
                <Select value={purchaseForm.currency} onValueChange={v => setPurchaseForm((f: any) => ({ ...f, currency: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="HKD">HKD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.unit_price')}</label>
                <Input type="number" step="0.01" placeholder="0.00" value={purchaseForm.unitPrice} onChange={e => setPurchaseForm((f: any) => ({ ...f, unitPrice: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.total_price')}</label>
                <Input type="number" step="0.01" placeholder="0.00" value={purchaseForm.totalPrice} onChange={e => setPurchaseForm((f: any) => ({ ...f, totalPrice: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.source')}</label>
                <Input placeholder="iHerb" value={purchaseForm.source} onChange={e => setPurchaseForm((f: any) => ({ ...f, source: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.order_no')}</label>
                <Input placeholder="HK12345678" value={purchaseForm.orderNo} onChange={e => setPurchaseForm((f: any) => ({ ...f, orderNo: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('common.notes')}</label>
              <Input placeholder={t('common.optional_notes')} value={purchaseForm.notes} onChange={e => setPurchaseForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </div>
            {!editPurchase && (
              <div className="flex items-center justify-between border border-border rounded-xl p-3">
                <div>
                  <p className="text-sm font-medium">{t('supplements.add_to_stock')}</p>
                  <p className="text-xs text-muted-foreground">{t('supplements.add_to_stock_hint')}</p>
                </div>
                <button type="button" onClick={() => setPurchaseForm((f: any) => ({ ...f, addToStock: !f.addToStock }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${purchaseForm.addToStock ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${purchaseForm.addToStock ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPurchaseDialog(false); setEditPurchase(null); }}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              if (!purchaseForm.supplementId || !purchaseForm.purchaseDate || !purchaseForm.quantity) { toast.error(t('common.fill_required')); return; }
              const payload = { supplementId: Number(purchaseForm.supplementId), purchaseDate: purchaseForm.purchaseDate, quantity: Number(purchaseForm.quantity), unitPrice: purchaseForm.unitPrice || undefined, totalPrice: purchaseForm.totalPrice || undefined, currency: purchaseForm.currency || undefined, source: purchaseForm.source || undefined, orderNo: purchaseForm.orderNo || undefined, notes: purchaseForm.notes || undefined };
              if (editPurchase) updatePurchase.mutate({ id: editPurchase.id, ...payload });
              else addPurchase.mutate({ ...payload, addToStock: purchaseForm.addToStock });
            }} disabled={addPurchase.isPending || updatePurchase.isPending}>
              {(addPurchase.isPending || updatePurchase.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restock Dialog */}
      <Dialog open={showRestockDialog} onOpenChange={setShowRestockDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('supplements.restock')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.supplement')}</label>
              <Select value={restockForm.supplementId} onValueChange={v => setRestockForm((f: any) => ({ ...f, supplementId: v }))}>
                <SelectTrigger><SelectValue placeholder={t('supplements.select_supplement')} /></SelectTrigger>
                <SelectContent>{supplements.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('supplements.add_quantity')}</label>
              <Input type="number" min="1" placeholder="e.g. 90" value={restockForm.quantity} onChange={e => setRestockForm((f: any) => ({ ...f, quantity: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestockDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              if (!restockForm.supplementId || !restockForm.quantity) { toast.error(t('common.fill_required')); return; }
              restock.mutate({ id: Number(restockForm.supplementId), quantity: Number(restockForm.quantity) });
            }} disabled={restock.isPending}>
              {restock.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('supplements.restock')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
