import React from 'react';
import { Button } from '../../../shared/ui/button';
import { Badge } from '../../../shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../shared/ui/card';
import {
  Play,
  Calendar,
  BarChart3,
  Edit2,
  Trash2,
} from 'lucide-react';
import { getCategoryColor, getCategoryIconComponent } from '../utils/incentiveHelpers';

export const TemplateCard = React.memo(({ template, onEdit, onDelete, onUse }) => {
  const CategoryIcon = getCategoryIconComponent(template.category);

  return (
    <Card className="hover:border-orange-500/30 hover:shadow-md transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
            style={{ backgroundColor: `${template.banner_color}20` }}
          >
            {template.icon}
          </div>
          <div className="flex items-center gap-1">
            <Badge className={getCategoryColor(template.category)}>
              <CategoryIcon className="w-4 h-4" />
              <span className="ml-1 capitalize">
                {template.category?.replace('_', ' ')}
              </span>
            </Badge>
          </div>
        </div>
        <CardTitle className="text-lg mt-3">{template.name}</CardTitle>
        <CardDescription>{template.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {template.description}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {template.default_duration_days} days
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            {template.default_scope}
          </span>
        </div>
        {template.default_rules?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {template.default_rules.map((rule, idx) => (
              <Badge key={idx} variant="outline" className="text-xs capitalize">
                {rule.type?.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Used {template.times_used || 0} times
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(template)}>
              <Edit2 className="w-4 h-4" />
            </Button>
            {!template.is_system && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500"
                onClick={() => onDelete(template.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
              onClick={() => onUse(template)}
              data-testid={`use-template-${template.id}`}
            >
              <Play className="w-4 h-4 mr-1" />
              Launch
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
