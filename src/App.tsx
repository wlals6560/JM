import React, { useState } from 'react';
import {
  Search,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ExternalLink,
  Loader2,
  BarChart3,
  Calendar,
  Zap,
  Globe,
  MapPin
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { analyzeGameTrends, TrendAnalysis, RegionAnalysis } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RegionSectionProps {
  title: string;
  icon: React.ReactNode;
  data: RegionAnalysis;
  colorClass: string;
}

const RegionSection = ({ title, icon, data, colorClass }: RegionSectionProps) => {
  if (!data.hasData) {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className={cn("flex items-center gap-3 p-4 rounded-2xl border", colorClass)}>
          {icon}
          <h2 className="text-2xl font-bold tracking-tight">{title} 동향 분석</h2>
        </div>
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">해당 지역의 커뮤니티 동향을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const sentimentData = [
    { name: `긍정 (${data.sentiment.positive}%)`, value: data.sentiment.positive || 0, color: '#10b981' },
    { name: `중립 (${data.sentiment.neutral}%)`, value: data.sentiment.neutral || 0, color: '#94a3b8' },
    { name: `부정 (${data.sentiment.negative}%)`, value: data.sentiment.negative || 0, color: '#ef4444' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className={cn("flex items-center gap-3 p-4 rounded-2xl border", colorClass)}>
        {icon}
        <h2 className="text-2xl font-bold tracking-tight">{title} 동향 분석</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold">주간 핵심 요약</h3>
          </div>
          <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
            <ReactMarkdown>{data.weeklySummary}</ReactMarkdown>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <ThumbsUp className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold">유저 감성 분석</h3>
          </div>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-6 h-6 text-orange-500 fill-orange-500" />
          <h3 className="text-xl font-bold tracking-tight">실시간 핫 토픽</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.hotTopics.map((topic, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded">
                    Topic {idx + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                      topic.sentiment === 'positive'
                        ? "bg-blue-100 text-blue-600 border border-blue-200"
                        : "bg-rose-100 text-rose-600 border border-rose-200"
                    )}
                  >
                    {topic.sentiment === 'positive' ? '긍정' : '부정'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-orange-500">
                  <Zap className="w-3 h-3 fill-current" />
                  <span className="text-xs font-bold">{topic.heat}°C</span>
                </div>
              </div>
              <h4 className="text-lg font-bold mb-2 group-hover:text-indigo-600 transition-colors">{topic.title}</h4>
              <p className="text-slate-600 text-sm leading-relaxed">{topic.description}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
          <div className="flex items-center gap-2 mb-6 text-emerald-700">
            <ThumbsUp className="w-6 h-6" />
            <h3 className="text-xl font-bold">긍정 동향</h3>
          </div>
          <ul className="space-y-4">
            {data.positiveTrends.map((trend, idx) => (
              <li key={idx} className="flex gap-3 bg-white p-4 rounded-xl border border-emerald-200/50 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                <p className="text-slate-700 text-sm">{trend}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-rose-50/50 p-6 rounded-2xl border border-rose-100">
          <div className="flex items-center gap-2 mb-6 text-rose-700">
            <ThumbsDown className="w-6 h-6" />
            <h3 className="text-xl font-bold">부정 동향</h3>
          </div>
          <ul className="space-y-4">
            {data.negativeTrends.map((trend, idx) => (
              <li key={idx} className="flex gap-3 bg-white p-4 rounded-xl border border-rose-200/50 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0" />
                <p className="text-slate-700 text-sm">{trend}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [gameName, setGameName] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!gameName.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const result = await analyzeGameTrends(gameName);
      setAnalysis(result);
    } catch (err: any) {
      console.error(err);

      const message = String(err?.message || '');
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        setError('현재 AI 분석 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
      } else if (message.includes('너무 빠르게')) {
        setError(message);
      } else {
        setError('동향 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">GameTrend Insight</h1>
          </div>

          <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="게임 이름을 입력하세요 (예: Elden Ring)"
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent rounded-full text-sm transition-all"
              />
            </div>
          </form>

          <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" /> 주간 리포트
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3">
            <Zap className="w-5 h-5" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="text-slate-500 font-medium animate-pulse">
              한국 및 글로벌 커뮤니티 데이터를 분석하는 중입니다...
            </p>
          </div>
        ) : analysis ? (
          <div className="space-y-16">
            <div className="relative overflow-hidden rounded-3xl animate-in fade-in duration-1000 min-h-[320px] flex items-center justify-center bg-slate-900">
              <div className="absolute inset-0 z-0">
                {analysis.gameImageUrl && (
                  <img
                    src={analysis.gameImageUrl}
                    alt={analysis.gameTitle}
                    className="w-full h-full object-cover opacity-60"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900/90" />
              </div>

              <div className="relative z-10 py-16 px-6 text-center space-y-4">
                <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl drop-shadow-lg">
                  <span className="text-indigo-400">{analysis.gameTitle}</span>
                  <br />
                  게임 한국/글로벌 동향 분석
                </h2>
                <p className="text-slate-200 text-lg font-medium drop-shadow-md max-w-2xl mx-auto">
                  주요 커뮤니티 및 공식 채널 데이터를 기반으로 한 실시간 여론 분석 리포트
                </p>
                <div className="flex justify-center gap-2 pt-4">
                  <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-1.5 rounded-full text-sm font-medium">
                    최근 7일 분석
                  </span>
                  <span className="bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30 text-indigo-200 px-4 py-1.5 rounded-full text-sm font-medium">
                    실시간 데이터
                  </span>
                </div>
              </div>
            </div>

            <RegionSection
              title="한국"
              icon={<MapPin className="w-8 h-8 text-blue-600" />}
              data={analysis.korea}
              colorClass="bg-blue-50 border-blue-100 text-blue-900"
            />

            <div className="h-px bg-slate-200" />

            <RegionSection
              title="글로벌"
              icon={<Globe className="w-8 h-8 text-indigo-600" />}
              data={analysis.global}
              colorClass="bg-indigo-50 border-indigo-100 text-indigo-900"
            />

            {analysis.sources.length > 0 && (
              <section className="pt-8 border-t border-slate-200">
                <div className="flex items-center gap-2 mb-4 text-slate-500">
                  <MessageSquare className="w-5 h-5" />
                  <h2 className="text-lg font-bold">분석 출처</h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  {analysis.sources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-full text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-indigo-300 transition-all"
                    >
                      {source.title}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-slate-400">분석할 게임을 검색해주세요.</p>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">© 2026 GameTrend Insight. Powered by Google Gemini.</p>
        </div>
      </footer>
    </div>
  );
}
