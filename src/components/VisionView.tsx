import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';

export function VisionView() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const generateVision = async () => {
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: "A highly cinematic, photorealistic lifestyle shot representing this financial goal: " + prompt })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImage(data.imageUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate image');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">财务愿景版 (Vision Board)</h2>
        <p className="text-slate-500">将你的财务目标可视化。告诉 AI 你正在为之储蓄的目标（例如："一辆保时捷911"，"三亚的海景房"），它将为你生成专属驱动图。</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <input 
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="输入你的财务目标，例如：位于冰岛的极光玻璃屋..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateVision()}
            />
            <button 
              onClick={generateVision}
              disabled={isLoading || !prompt.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              生成愿景
            </button>
          </div>
          {error && <div className="text-rose-500 mt-2 text-sm">{error}</div>}
        </CardContent>
      </Card>

      <div className="min-h-[400px] border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50 relative overflow-hidden">
        {image ? (
          <img src={image} alt="Vision" className="w-full h-full object-cover" />
        ) : (
          <div className="text-slate-400 flex flex-col items-center gap-2">
            <ImageIcon className="w-12 h-12 opacity-50" />
            <p>生成的愿景图将显示在这里</p>
          </div>
        )}
      </div>
    </div>
  )
}
