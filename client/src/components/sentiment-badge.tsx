import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SentimentBadgeProps {
  score: number | null;
  category: string | null;
  trend: string | null;
  showScore?: boolean;
  showTrend?: boolean;
}

const categoryColors = {
  champion: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-300',
  loyal: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-300',
  active: 'bg-gray-100 text-gray-800 hover:bg-gray-100 border-gray-300',
  casual: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 border-yellow-300',
  inactive: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-300',
} as const;

const trendIcons = {
  improving: <TrendingUp className="h-3 w-3 text-green-600" />,
  stable: <Minus className="h-3 w-3 text-gray-600" />,
  declining: <TrendingDown className="h-3 w-3 text-red-600" />,
};

export function SentimentBadge({
  score,
  category,
  trend,
  showScore = false,
  showTrend = true,
}: SentimentBadgeProps) {
  if (!category) {
    return (
      <Badge variant="outline" className="text-xs">
        No data
      </Badge>
    );
  }

  const colorClass =
    categoryColors[category as keyof typeof categoryColors] || categoryColors.active;
  const trendIcon = trend && showTrend ? trendIcons[trend as keyof typeof trendIcons] : null;

  return (
    <Badge variant="outline" className={`text-xs ${colorClass} flex items-center gap-1`}>
      {category.charAt(0).toUpperCase() + category.slice(1)}
      {showScore && score !== null && ` (${score})`}
      {trendIcon && <span className="ml-1">{trendIcon}</span>}
    </Badge>
  );
}
