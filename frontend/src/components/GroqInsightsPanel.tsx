import { useEffect, useState } from 'react';

export default function GroqInsightsPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const res = await fetch(`/api/assistant/analyze/${encodeURIComponent(symbol)}`);
        if (!res.ok) throw new Error('Failed to fetch AI analysis');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [symbol]);

  if (loading) {
    return (
      <div className="glass-card flex flex-col items-center justify-center p-12 space-y-4 border border-amber-200/50">
        <div className="flex items-center gap-2">
           <span className="w-3 h-3 rounded-full bg-amber-400 animate-bounce"></span>
           <span className="w-3 h-3 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
           <span className="w-3 h-3 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
        </div>
        <p className="text-sm font-semibold text-amber-900/60 uppercase tracking-widest animate-pulse">Groq LLM is analyzing signals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card border-red-200 bg-red-50 text-red-600 p-6">
        ⚠️ Failed to load AI insights: {error}
      </div>
    );
  }

  return (
    <div className="card-warm relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-300/10 rounded-full blur-3xl -z-10 -mr-20 -mt-20"></div>
      
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-sm bg-gradient-to-br from-amber-400 to-amber-500">
           ✨
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900 tracking-tight">Groq Intelligence</h3>
          <p className="text-xs font-semibold text-amber-700/70 uppercase tracking-wider">Llama3-70b Realtime Analysis</p>
        </div>
      </div>

      <div className="prose prose-amber max-w-none">
        <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800 bg-white/50 p-6 rounded-2xl border border-amber-100/50 shadow-inner">
          {data?.ai_analysis || "No analysis generated."}
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
         <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Inference Powered by Groq</span>
      </div>
    </div>
  );
}
