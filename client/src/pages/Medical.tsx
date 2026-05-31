import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useIsOwner } from "@/contexts/OwnerContext";
import { toast } from "sonner";
import { todayHKString, formatHKDate } from "@/lib/hkTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Stethoscope, Trash2, Edit2, Loader2, ChevronRight, ChevronDown,
  Paperclip, FileText, Image, X, ArrowUpDown, Activity, AlertCircle
} from "lucide-react";
import { useTranslation } from "react-i18next";

const CATEGORIES = ['illness', 'injury', 'sports_injury', 'checkup', 'surgery', 'chronic', 'other'] as const;
const STATUSES = ['active', 'resolved', 'chronic', 'monitoring'] as const;
const VISIT_TYPES = ['consultation', 'xray', 'mri', 'blood_test', 'physio', 'checkup', 'followup', 'other'] as const;
const ATTACHMENT_TYPES = ['xray', 'mri', 'doctor_note', 'prescription', 'report', 'blood_test', 'other'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  illness: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  injury: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  sports_injury: 'bg-red-500/20 text-red-400 border-red-500/30',
  checkup: 'bg-green-500/20 text-green-400 border-green-500/30',
  surgery: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  chronic: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  other: 'bg-muted text-muted-foreground border-border',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-red-500/20 text-red-400',
  resolved: 'bg-green-500/20 text-green-400',
  chronic: 'bg-yellow-500/20 text-yellow-400',
  monitoring: 'bg-blue-500/20 text-blue-400',
};

const defaultConditionForm = { title: '', category: 'illness', status: 'active', startDate: todayHKString(), endDate: '', notes: '' };
const defaultVisitForm = { visitDate: todayHKString(), visitType: 'consultation', doctorName: '', clinic: '', diagnosis: '', prescription: '', followUpDate: '', notes: '' };

export default function Medical() {
  const { t } = useTranslation();
  const isOwner = useIsOwner();
  const [showConditionDialog, setShowConditionDialog] = useState(false);
  const [showVisitDialog, setShowVisitDialog] = useState(false);
  const [editCondition, setEditCondition] = useState<any>(null);
  const [editVisit, setEditVisit] = useState<any>(null);
  const [conditionForm, setConditionForm] = useState<any>(defaultConditionForm);
  const [visitForm, setVisitForm] = useState<any>(defaultVisitForm);
  const [selectedCondition, setSelectedCondition] = useState<any>(null);
  const [expandedConditions, setExpandedConditions] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<'date_desc' | 'date_asc' | 'status' | 'category'>('date_desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [uploadingVisitId, setUploadingVisitId] = useState<number | null>(null);
  const [attachNotes, setAttachNotes] = useState('');
  const [attachType, setAttachType] = useState('other');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: conditions = [], isLoading } = trpc.medical.getConditions.useQuery();

  const addCondition = trpc.medical.addCondition.useMutation({
    onSuccess: () => { utils.medical.getConditions.invalidate(); toast.success(t('medical.condition_added')); setShowConditionDialog(false); setConditionForm(defaultConditionForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateCondition = trpc.medical.updateCondition.useMutation({
    onSuccess: () => { utils.medical.getConditions.invalidate(); toast.success(t('common.updated')); setShowConditionDialog(false); setEditCondition(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCondition = trpc.medical.deleteCondition.useMutation({
    onSuccess: () => { utils.medical.getConditions.invalidate(); toast.success(t('common.deleted')); },
    onError: (e) => toast.error(e.message),
  });

  // Visits for selected condition
  const { data: visits = [], isLoading: visitsLoading } = trpc.medical.getVisits.useQuery(
    { conditionId: selectedCondition?.id ?? 0 },
    { enabled: !!selectedCondition }
  );
  const addVisit = trpc.medical.addVisit.useMutation({
    onSuccess: () => { utils.medical.getVisits.invalidate(); toast.success(t('medical.visit_added')); setShowVisitDialog(false); setVisitForm(defaultVisitForm); },
    onError: (e) => toast.error(e.message),
  });
  const updateVisit = trpc.medical.updateVisit.useMutation({
    onSuccess: () => { utils.medical.getVisits.invalidate(); toast.success(t('common.updated')); setShowVisitDialog(false); setEditVisit(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteVisit = trpc.medical.deleteVisit.useMutation({
    onSuccess: () => { utils.medical.getVisits.invalidate(); toast.success(t('common.deleted')); },
    onError: (e) => toast.error(e.message),
  });

  // Attachments for a visit
  const [viewingVisitAttachments, setViewingVisitAttachments] = useState<number | null>(null);
  const { data: attachments = [] } = trpc.medical.getAttachments.useQuery(
    { visitId: viewingVisitAttachments ?? 0 },
    { enabled: !!viewingVisitAttachments }
  );
  const uploadAttachment = trpc.medical.uploadAttachment.useMutation({
    onSuccess: () => { utils.medical.getAttachments.invalidate(); toast.success(t('medical.file_uploaded')); setUploadingVisitId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteAttachment = trpc.medical.deleteAttachment.useMutation({
    onSuccess: () => { utils.medical.getAttachments.invalidate(); toast.success(t('common.deleted')); },
    onError: (e) => toast.error(e.message),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingVisitId) return;
    if (file.size > 16 * 1024 * 1024) { toast.error(t('medical.file_too_large')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadAttachment.mutate({
        visitId: uploadingVisitId,
        fileName: file.name,
        fileType: file.type,
        fileBase64: base64,
        attachmentType: attachType,
        notes: attachNotes,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Sort/filter conditions
  let displayConditions = [...conditions];
  if (statusFilter !== 'all') displayConditions = displayConditions.filter((c: any) => c.status === statusFilter);
  if (categoryFilter !== 'all') displayConditions = displayConditions.filter((c: any) => c.category === categoryFilter);
  switch (sort) {
    case 'date_asc': displayConditions.sort((a: any, b: any) => new Date(a.startDate || a.createdAt).getTime() - new Date(b.startDate || b.createdAt).getTime()); break;
    case 'date_desc': displayConditions.sort((a: any, b: any) => new Date(b.startDate || b.createdAt).getTime() - new Date(a.startDate || a.createdAt).getTime()); break;
    case 'status': displayConditions.sort((a: any, b: any) => (a.status || '').localeCompare(b.status || '')); break;
    case 'category': displayConditions.sort((a: any, b: any) => (a.category || '').localeCompare(b.category || '')); break;
  }

  const toggleExpand = (id: number) => {
    setExpandedConditions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-primary" />
            {t('medical.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('medical.subtitle')}</p>
        </div>
        {isOwner && (
          <Button onClick={() => { setEditCondition(null); setConditionForm(defaultConditionForm); setShowConditionDialog(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> {t('medical.add_condition')}
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('medical.total'), value: conditions.length, color: 'text-foreground', icon: <Activity className="w-4 h-4 text-primary" /> },
          { label: t('medical.active'), value: conditions.filter((c: any) => c.status === 'active').length, color: 'text-red-400', icon: <AlertCircle className="w-4 h-4 text-red-400" /> },
          { label: t('medical.resolved'), value: conditions.filter((c: any) => c.status === 'resolved').length, color: 'text-green-400', icon: <Activity className="w-4 h-4 text-green-400" /> },
          { label: t('medical.chronic'), value: conditions.filter((c: any) => c.status === 'chronic').length, color: 'text-yellow-400', icon: <Activity className="w-4 h-4 text-yellow-400" /> },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            {s.icon}
            <div>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter/sort bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all_status')}</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`medical.status_${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all_categories')}</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`medical.cat_${c}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={v => setSort(v as any)}>
          <SelectTrigger className="h-8 w-44 text-xs"><ArrowUpDown className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="date_desc">{t('common.sort_date_desc')}</SelectItem>
            <SelectItem value="date_asc">{t('common.sort_date_asc')}</SelectItem>
            <SelectItem value="status">{t('medical.sort_status')}</SelectItem>
            <SelectItem value="category">{t('medical.sort_category')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{displayConditions.length} {t('common.records')}</span>
      </div>

      {/* Conditions list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : displayConditions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t('medical.no_records')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayConditions.map((cond: any) => (
            <div key={cond.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Condition header */}
              <div className="p-4 flex items-start gap-3">
                <button className="mt-0.5 shrink-0" onClick={() => toggleExpand(cond.id)}>
                  {expandedConditions.has(cond.id) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">{cond.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cond.category] || CATEGORY_COLORS.other}`}>
                      {t(`medical.cat_${cond.category}`)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[cond.status] || STATUS_COLORS.monitoring}`}>
                      {t(`medical.status_${cond.status}`)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {cond.startDate && <span>{t('medical.start')}: {formatHKDate(cond.startDate)}</span>}
                    {cond.endDate && <span>{t('medical.end')}: {formatHKDate(cond.endDate)}</span>}
                  </div>
                  {cond.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cond.notes}</p>}
                </div>
                {isOwner && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
                      setEditCondition(cond);
                      setConditionForm({ title: cond.title, category: cond.category || 'illness', status: cond.status || 'active', startDate: cond.startDate || '', endDate: cond.endDate || '', notes: cond.notes || '' });
                      setShowConditionDialog(true);
                    }}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => deleteCondition.mutate({ id: cond.id })}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                )}
              </div>

              {/* Expanded: visits */}
              {expandedConditions.has(cond.id) && (
                <div className="border-t border-border bg-muted/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">{t('medical.visits')}</h4>
                    {isOwner && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                        setSelectedCondition(cond);
                        setEditVisit(null);
                        setVisitForm({ ...defaultVisitForm, conditionId: cond.id });
                        setShowVisitDialog(true);
                      }}>
                        <Plus className="w-3 h-3" /> {t('medical.add_visit')}
                      </Button>
                    )}
                  </div>
                  <VisitsList
                    conditionId={cond.id}
                    t={t}
                    onEdit={(v: any) => {
                      setSelectedCondition(cond);
                      setEditVisit(v);
                      setVisitForm({ visitDate: v.visitDate, visitType: v.visitType || 'consultation', doctorName: v.doctorName || '', clinic: v.clinic || '', diagnosis: v.diagnosis || '', prescription: v.prescription || '', followUpDate: v.followUpDate || '', notes: v.notes || '' });
                      setShowVisitDialog(true);
                    }}
                    onDelete={(id: number) => deleteVisit.mutate({ id })}
                    onViewAttachments={(visitId: number) => setViewingVisitAttachments(visitId === viewingVisitAttachments ? null : visitId)}
                    viewingAttachments={viewingVisitAttachments}
                    attachments={attachments}
                    onUpload={(visitId: number) => { setUploadingVisitId(visitId); setAttachNotes(''); setAttachType('other'); fileInputRef.current?.click(); }}
                    onDeleteAttachment={(id: number) => deleteAttachment.mutate({ id })}
                    uploadingVisitId={uploadingVisitId}
                    uploadPending={uploadAttachment.isPending}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden"
        accept="image/*,.pdf,.doc,.docx"
        onChange={handleFileUpload} />

      {/* Attachment type/notes dialog */}
      {uploadingVisitId && !uploadAttachment.isPending && (
        <Dialog open={true} onOpenChange={() => setUploadingVisitId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{t('medical.upload_file')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('medical.attachment_type')}</label>
                <Select value={attachType} onValueChange={setAttachType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ATTACHMENT_TYPES.map(a => <SelectItem key={a} value={a}>{t(`medical.attach_${a}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('common.notes')}</label>
                <Input placeholder={t('common.optional_notes')} value={attachNotes} onChange={e => setAttachNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadingVisitId(null)}>{t('common.cancel')}</Button>
              <Button onClick={() => fileInputRef.current?.click()}>{t('medical.choose_file')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Condition Dialog */}
      <Dialog open={showConditionDialog} onOpenChange={setShowConditionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editCondition ? t('medical.edit_condition') : t('medical.add_condition')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('medical.condition_title')} *</label>
              <Input placeholder={t('medical.condition_title_placeholder')} value={conditionForm.title} onChange={e => setConditionForm((f: any) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('medical.category')}</label>
                <Select value={conditionForm.category} onValueChange={v => setConditionForm((f: any) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{t(`medical.cat_${c}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('medical.status')}</label>
                <Select value={conditionForm.status} onValueChange={v => setConditionForm((f: any) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{t(`medical.status_${s}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('medical.start_date')}</label>
                <Input type="date" value={conditionForm.startDate} onChange={e => setConditionForm((f: any) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('medical.end_date')}</label>
                <Input type="date" value={conditionForm.endDate} onChange={e => setConditionForm((f: any) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('common.notes')}</label>
              <Textarea placeholder={t('common.optional_notes')} value={conditionForm.notes} onChange={e => setConditionForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowConditionDialog(false); setEditCondition(null); }}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              if (!conditionForm.title.trim()) { toast.error(t('medical.title_required')); return; }
              const condPayload = { ...conditionForm, endDate: conditionForm.endDate || undefined };
              if (editCondition) updateCondition.mutate({ id: editCondition.id, ...condPayload });
              else addCondition.mutate(condPayload);
            }} disabled={addCondition.isPending || updateCondition.isPending}>
              {(addCondition.isPending || updateCondition.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visit Dialog */}
      <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editVisit ? t('medical.edit_visit') : t('medical.add_visit')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('medical.visit_date')} *</label>
                <Input type="date" value={visitForm.visitDate} onChange={e => setVisitForm((f: any) => ({ ...f, visitDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('medical.visit_type')}</label>
                <Select value={visitForm.visitType} onValueChange={v => setVisitForm((f: any) => ({ ...f, visitType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VISIT_TYPES.map(v => <SelectItem key={v} value={v}>{t(`medical.visit_${v}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('medical.doctor')}</label>
                <Input placeholder={t('medical.doctor_placeholder')} value={visitForm.doctorName} onChange={e => setVisitForm((f: any) => ({ ...f, doctorName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{t('medical.clinic')}</label>
                <Input placeholder={t('medical.clinic_placeholder')} value={visitForm.clinic} onChange={e => setVisitForm((f: any) => ({ ...f, clinic: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('medical.diagnosis')}</label>
              <Textarea placeholder={t('medical.diagnosis_placeholder')} value={visitForm.diagnosis} onChange={e => setVisitForm((f: any) => ({ ...f, diagnosis: e.target.value }))} rows={2} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('medical.prescription')}</label>
              <Textarea placeholder={t('medical.prescription_placeholder')} value={visitForm.prescription} onChange={e => setVisitForm((f: any) => ({ ...f, prescription: e.target.value }))} rows={2} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('medical.follow_up')}</label>
              <Input type="date" value={visitForm.followUpDate} onChange={e => setVisitForm((f: any) => ({ ...f, followUpDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t('common.notes')}</label>
              <Textarea placeholder={t('common.optional_notes')} value={visitForm.notes} onChange={e => setVisitForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowVisitDialog(false); setEditVisit(null); }}>{t('common.cancel')}</Button>
            <Button onClick={() => {
              const visitPayload = { ...visitForm, followUpDate: visitForm.followUpDate || undefined };
              if (editVisit) updateVisit.mutate({ id: editVisit.id, ...visitPayload });
              else addVisit.mutate({ conditionId: selectedCondition?.id, ...visitPayload });
            }} disabled={addVisit.isPending || updateVisit.isPending}>
              {(addVisit.isPending || updateVisit.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for visits list (loads its own data)
function VisitsList({ conditionId, t, onEdit, onDelete, onViewAttachments, viewingAttachments, attachments, onUpload, onDeleteAttachment, uploadingVisitId, uploadPending }: any) {
  const { data: visits = [], isLoading } = trpc.medical.getVisits.useQuery({ conditionId });
  if (isLoading) return <div className="py-4 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" /></div>;
  if (visits.length === 0) return <p className="text-xs text-muted-foreground py-2">{t('medical.no_visits')}</p>;
  return (
    <div className="space-y-2">
      {visits.map((v: any) => (
        <div key={v.id} className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-foreground">{formatHKDate(v.visitDate)}</span>
                <Badge variant="outline" className="text-xs">{t(`medical.visit_${v.visitType}`)}</Badge>
                {v.doctorName && <span className="text-xs text-muted-foreground">{v.doctorName}</span>}
                {v.clinic && <span className="text-xs text-muted-foreground">· {v.clinic}</span>}
              </div>
              {v.diagnosis && <p className="text-xs text-foreground/80 mt-1"><span className="font-medium">{t('medical.diagnosis')}:</span> {v.diagnosis}</p>}
              {v.prescription && <p className="text-xs text-foreground/80"><span className="font-medium">{t('medical.prescription')}:</span> {v.prescription}</p>}
              {v.followUpDate && <p className="text-xs text-blue-400 mt-1">{t('medical.follow_up')}: {formatHKDate(v.followUpDate)}</p>}
              {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
              {/* Attachments toggle */}
              <div className="flex items-center gap-2 mt-2">
                <button className="text-xs text-primary flex items-center gap-1 hover:underline" onClick={() => onViewAttachments(v.id)}>
                  <Paperclip className="w-3 h-3" /> {t('medical.attachments')}
                  {viewingAttachments === v.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                <button className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground" onClick={() => onUpload(v.id)}>
                  <Plus className="w-3 h-3" /> {t('medical.upload')}
                </button>
              </div>
              {/* Attachments list */}
              {viewingAttachments === v.id && (
                <div className="mt-2 space-y-1">
                  {attachments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('medical.no_attachments')}</p>
                  ) : attachments.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 bg-muted/30 rounded-lg px-2 py-1.5">
                      {a.fileType?.startsWith('image/') ? <Image className="w-3.5 h-3.5 text-blue-400 shrink-0" /> : <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex-1 truncate">{a.fileName}</a>
                      <span className="text-xs text-muted-foreground">{t(`medical.attach_${a.attachmentType}`)}</span>
                      <button onClick={() => onDeleteAttachment(a.id)}><X className="w-3 h-3 text-destructive hover:opacity-80" /></button>
                    </div>
                  ))}
                  {uploadPending && uploadingVisitId === v.id && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> {t('medical.uploading')}</div>}
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => onEdit(v)}><Edit2 className="w-3 h-3" /></Button>
              <Button variant="ghost" size="icon" className="w-6 h-6 text-destructive" onClick={() => onDelete(v.id)}><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
