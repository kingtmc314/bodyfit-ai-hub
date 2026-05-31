import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { todayHKString, formatHKDate } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pill, Trash2, Edit2, Loader2, ArrowUpDown, AlertTriangle, Package, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

const CATEGORIES = ['protein', 'vitamin', 'mineral', 'omega3', 'pre_workout', 'post_workout', 'probiotic', 'collagen', 'creatine', 'bcaa', 'electrolyte', 'other'] as const;
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
  other: 'bg-muted text-muted-foreground',
};

const defaultSupplementForm = { name: '', brand: '', category: 'vitamin', servingSize: '', currentStock: '', lowStockThreshold: '30', purchaseDate: '', expiryDate: '', notes: '', isActive: true };
const defaultLogForm = { supplementId: '', date: todayHKString(), quantity: '1', timeOfDay: 'morning', notes: '' };
const defaultRestockForm = { supplementId: '', quantity: '' };

export default function Supplements() {
  const { t } = useTranslation();
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

  const utils = trpc.useUtils();
  const { data: supplements = [], isLoading } = trpc.supplements.getAll.useQuery();
  const { data: logs = [] } = trpc.supplements.getLogs.useQuery({ limit: 200 });

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
    onSuccess: () => { utils.supplements.getLogs.invalidate(); utils.supplements.getAll.invalidate(); toast.success(t('common.deleted')); },
    onError: (e) => toast.error(e.message),
  });
  const restock = trpc.supplements.restockSupplement.useMutation({
    onSuccess: () => { utils.supplements.getAll.invalidate(); toast.success(t('supplements.restocked')); setShowRestockDialog(false); setRestockForm(defaultRestockForm); },
    onError: (e) => toast.error(e.message),
  });

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowLogDialog(true); setLogForm(defaultLogForm); }} className="gap-2 text-sm">
            <Plus className="w-4 h-4" /> {t('supplements.log_intake')}
          </Button>
          <Button onClick={() => { setEditSupplement(null); setSupplementForm(defaultSupplementForm); setShowSupplementDialog(true); }} className="gap-2 text-sm">
            <Plus className="w-4 h-4" /> {t('supplements.add')}
          </Button>
        </div>
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
        <TabsList>
          <TabsTrigger value="inventory">{t('supplements.inventory')}</TabsTrigger>
          <TabsTrigger value="log">{t('supplements.intake_log')}</TabsTrigger>
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
                          <h3 className="font-semibold text-foreground text-sm truncate">{s.name}</h3>
                          {!s.isActive && <Badge variant="outline" className="text-xs">{t('supplements.inactive')}</Badge>}
                        </div>
                        {s.brand && <p className="text-xs text-muted-foreground">{s.brand}</p>}
                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${CATEGORY_COLORS[s.category] || CATEGORY_COLORS.other}`}>
                          {t(`supplements.cat_${s.category}`)}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => {
                          setEditSupplement(s);
                          setSupplementForm({ name: s.name, brand: s.brand || '', category: s.category || 'vitamin', servingSize: s.servingSize || '', currentStock: s.currentStock ?? '', lowStockThreshold: s.lowStockThreshold ?? 30, purchaseDate: s.purchaseDate || '', expiryDate: s.expiryDate || '', notes: s.notes || '', isActive: s.isActive ?? true });
                          setShowSupplementDialog(true);
                        }}><Edit2 className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive" onClick={() => deleteSupplement.mutate({ id: s.id })}><Trash2 className="w-3 h-3" /></Button>
                      </div>
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
                      {s.expiryDate && <p className={new Date(s.expiryDate) < new Date() ? 'text-red-400' : ''}>{t('supplements.expiry')}: {formatHKDate(s.expiryDate)}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => { setLogForm({ ...defaultLogForm, supplementId: String(s.id) }); setShowLogDialog(true); }}>
                        <Plus className="w-3 h-3" /> {t('supplements.log_intake')}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setRestockForm({ supplementId: String(s.id), quantity: '' }); setShowRestockDialog(true); }}>
                        <RefreshCw className="w-3 h-3" /> {t('supplements.restock')}
                      </Button>
                    </div>
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
            <span className="text-xs text-muted-foreground ml-auto">{displayLogs.length} {t('common.records')}</span>
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
                          <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteLog.mutate({ id: l.id, quantity: l.quantity ?? 1, supplementId: l.supplementId })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSupplementDialog(false); setEditSupplement(null); }}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              if (!supplementForm.name.trim()) { toast.error(t('supplements.name_required')); return; }
              const payload = { ...supplementForm, currentStock: supplementForm.currentStock ? Number(supplementForm.currentStock) : undefined, lowStockThreshold: supplementForm.lowStockThreshold ? Number(supplementForm.lowStockThreshold) : 30 };
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
