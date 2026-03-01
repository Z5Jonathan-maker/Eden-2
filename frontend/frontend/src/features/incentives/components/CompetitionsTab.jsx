import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { Card, CardContent } from '../../../shared/ui/card';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../../shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../shared/ui/select';
import {
  Trophy,
  Users,
  Play,
  StopCircle,
  Plus,
  Loader2,
  RefreshCw,
  Clock,
  Crown,
  Eye,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { getStatusBadge } from '../utils/incentiveHelpers';

export const CompetitionsTab = () => {
  const [competitions, setCompetitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [newCompName, setNewCompName] = useState('');
  const [newCompStartDate, setNewCompStartDate] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCompetitions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/incentives/competitions?include_past=true');
      if (!res.ok) {
        console.error('Failed to fetch competitions: Status', res.ok);
        setLoading(false);
        return;
      }
      setCompetitions(res.data.competitions || []);
    } catch (err) {
      console.error('Failed to fetch competitions:', err);
    }
    setLoading(false);
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await apiGet('/api/incentives/templates');
      if (!res.ok) {
        console.error('Failed to fetch templates: Status', res.ok);
        return;
      }
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  }, []);

  useEffect(() => {
    fetchCompetitions();
    fetchTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !newCompName || !newCompStartDate) return;

    setCreating(true);
    try {
      const res = await apiPost('/api/incentives/competitions/from-template', {
        template_id: selectedTemplate,
        name: newCompName,
        start_date: new Date(newCompStartDate).toISOString(),
      });

      if (res.ok) {
        setShowCreateDialog(false);
        setSelectedTemplate(null);
        setNewCompName('');
        setNewCompStartDate('');
        fetchCompetitions();
      }
    } catch (err) {
      console.error('Failed to create competition:', err);
    }
    setCreating(false);
  };

  const handleStartCompetition = async (compId) => {
    try {
      await apiPost(`/api/incentives/competitions/${compId}/start`, {});
      fetchCompetitions();
    } catch (err) {
      console.error('Failed to start competition:', err);
    }
  };

  const handleEndCompetition = async (compId) => {
    if (
      !window.confirm('Are you sure you want to end this competition? Results will be calculated.')
    )
      return;

    try {
      await apiPost(`/api/incentives/competitions/${compId}/end`, {});
      fetchCompetitions();
    } catch (err) {
      console.error('Failed to end competition:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Competitions</h2>
          <p className="text-sm text-muted-foreground">
            {competitions.filter((c) => c.status === 'active').length} active, {competitions.length}{' '}
            total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCompetitions}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-2" />
                New Competition
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Competition</DialogTitle>
                <DialogDescription>
                  Select a template and customize your competition
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={selectedTemplate || ''} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="mr-2">{t.icon}</span>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTemplate && (
                    <p className="text-xs text-muted-foreground">
                      {templates.find((t) => t.id === selectedTemplate)?.tagline}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Competition Name</Label>
                  <Input
                    placeholder="e.g., February Weekend Blitz"
                    value={newCompName}
                    onChange={(e) => setNewCompName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={newCompStartDate}
                    onChange={(e) => setNewCompStartDate(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateFromTemplate}
                  disabled={!selectedTemplate || !newCompName || !newCompStartDate || creating}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Competition Cards */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : competitions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Trophy className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-muted-foreground mb-4">No competitions yet</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Competition
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {competitions.map((comp) => (
            <Card key={comp.id} className="hover:border-orange-200 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${comp.banner_color}20` }}
                    >
                      {comp.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{comp.name}</h3>
                        <Badge className={getStatusBadge(comp.status)}>{comp.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {comp.tagline || comp.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {comp.participant_count} participants
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {comp.time_remaining}
                        </span>
                        {comp.leader && comp.leader.value > 0 && (
                          <span className="flex items-center gap-1">
                            <Crown className="w-4 h-4 text-yellow-500" />
                            {comp.leader.name}: {comp.leader.value}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {comp.status === 'scheduled' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartCompetition(comp.id)}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Start
                      </Button>
                    )}
                    {comp.status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEndCompetition(comp.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <StopCircle className="w-4 h-4 mr-1" />
                        End
                      </Button>
                    )}
                    <Button size="sm" variant="ghost">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
