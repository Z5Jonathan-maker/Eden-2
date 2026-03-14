import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { Card, CardContent } from '../../../shared/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/api';

export const MetricsTab = () => {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/incentives/metrics');
      if (!res.ok) {
        console.error('Failed to fetch metrics: Status', res.ok);
        setLoading(false);
        return;
      }
      setMetrics(res.data.metrics || []);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Available Metrics</h2>
          <p className="text-sm text-muted-foreground">KPIs that can power competitions</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMetrics}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric) => (
            <Card key={metric.id} className="hover:border-orange-500/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-xl">
                    {metric.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{metric.name}</h3>
                    <p className="text-sm text-muted-foreground">{metric.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {metric.aggregation}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {metric.unit}
                      </Badge>
                      {metric.is_system && (
                        <Badge variant="secondary" className="text-xs">
                          System
                        </Badge>
                      )}
                    </div>
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
