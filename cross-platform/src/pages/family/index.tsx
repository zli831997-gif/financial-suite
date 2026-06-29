import { useState, useEffect } from 'react';
import { View, Text, Input } from '@tarojs/components';
import {
  isSyncEnabled,
  getCurrentUser,
  signUp,
  signIn,
  signOut,
  createHousehold,
  joinHousehold,
  getMyHousehold,
  type Household,
} from '../../lib/supabase';
import { copyText } from '../../utils/platform';
import { Card, CardContent } from '../../components/ui/card';
import { Icon } from '../../components/Icon';
import { Motion } from '../../components/Motion';
import './index.css';

/**
 * 家庭组队记账页。
 * 流程：登录注册 → 创建家庭(生成匹配码) / 输入码加入 → 共享账本同步。
 * 未配置 Supabase 时，提示用户后端未启用。
 */
export default function Family() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled] = useState(isSyncEnabled());

  // 认证表单
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authErr, setAuthErr] = useState('');

  // 家庭表单
  const [familyName, setFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [familyErr, setFamilyErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getCurrentUser();
      setUser(u);
      if (u) {
        const h = await getMyHousehold();
        setHousehold(h);
      }
      setLoading(false);
    })();
  }, []);

  const handleAuth = async () => {
    setAuthErr('');
    if (!email || !password) {
      setAuthErr('请填写邮箱和密码');
      return;
    }
    const res = isLogin ? await signIn(email, password) : await signUp(email, password);
    if (res.error) {
      setAuthErr(res.error);
      return;
    }
    if (res.user) {
      setUser(res.user);
      const h = await getMyHousehold();
      setHousehold(h);
    }
  };

  const handleCreate = async () => {
    setFamilyErr('');
    if (!familyName.trim()) {
      setFamilyErr('请输入家庭名称');
      return;
    }
    const res = await createHousehold(familyName.trim());
    if (res.error || !res.household) {
      setFamilyErr(res.error || '创建失败');
      return;
    }
    setHousehold(res.household);
  };

  const handleJoin = async () => {
    setFamilyErr('');
    if (!joinCode.trim()) {
      setFamilyErr('请输入匹配码');
      return;
    }
    const res = await joinHousehold(joinCode.trim());
    if (res.error || !res.household) {
      setFamilyErr(res.error || '加入失败');
      return;
    }
    setHousehold(res.household);
  };

  const handleCopy = async () => {
    if (!household) return;
    const ok = await copyText(household.invite_code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setHousehold(null);
  };

  // 1. 未配置后端
  if (!enabled) {
    return (
      <View className='p-4 min-h-screen bg-slate-50 flex items-center justify-center'>
        <Card className='border-amber-200'>
          <CardContent className='p-6 text-center'>
            <Text className='text-3xl block'>🔧</Text>
            <Text className='text-sm font-bold text-slate-800 block mt-2'>组队记账尚未启用</Text>
            <Text className='text-[11px] text-slate-400 leading-relaxed block mt-2'>
              家庭组队同步需要后端服务支持。{'\n'}管理员配置 Supabase 后，此功能自动启用。{'\n\n'}
              本地记账（含标签、补记）完全可用，不受影响。
            </Text>
          </CardContent>
        </Card>
      </View>
    );
  }

  if (loading) {
    return (
      <View className='p-4 min-h-screen bg-slate-50 flex items-center justify-center'>
        <Text className='text-xs text-slate-400'>加载中...</Text>
      </View>
    );
  }

  return (
    <View className='p-4 space-y-4 max-w-md mx-auto w-full min-h-screen bg-slate-50 pb-6'>
      <View className='pb-1 border-b border-slate-100'>
        <Text className='text-base font-black text-slate-900 flex items-center gap-1.5'>
          <Icon name='user' size={18} className='text-indigo-600' /> 家庭组队记账
        </Text>
        <Text className='text-[10px] text-slate-400 block'>和家人共享同一本账本，一起记账</Text>
      </View>

      {/* 2. 未登录 */}
      {!user && (
        <View className='space-y-4'>
          <Card>
            <CardContent className='p-5 space-y-3'>
              <View className='flex bg-slate-100 p-1 rounded-xl'>
                <Motion
                  tapScale={0.95}
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg text-center ${isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  登录
                </Motion>
                <Motion
                  tapScale={0.95}
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg text-center ${!isLogin ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                >
                  注册
                </Motion>
              </View>
              <View>
                <Text className='text-[10px] font-bold text-slate-500 block mb-1'>邮箱</Text>
                <Input
                  type='text'
                  value={email}
                  onInput={(e) => setEmail(e.detail.value)}
                  placeholder='you@example.com'
                  className='w-full bg-slate-100 rounded-xl px-4 py-2.5 text-sm'
                />
              </View>
              <View>
                <Text className='text-[10px] font-bold text-slate-500 block mb-1'>密码（至少6位）</Text>
                <Input
                  password
                  value={password}
                  onInput={(e) => setPassword(e.detail.value)}
                  placeholder='******'
                  className='w-full bg-slate-100 rounded-xl px-4 py-2.5 text-sm'
                />
              </View>
              {authErr && <Text className='text-[10px] text-rose-500 block'>{authErr}</Text>}
              <Motion
                tapScale={0.98}
                onClick={handleAuth}
                className='w-full py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm text-center'
              >
                {isLogin ? '登录' : '注册并登录'}
              </Motion>
              <Text className='text-[9px] text-slate-400 text-center block leading-relaxed'>
                💡 账号用于识别家庭成员。{'\n'}家人各自注册账号，再用匹配码加入同一个家庭组。
              </Text>
            </CardContent>
          </Card>
        </View>
      )}

      {/* 3. 已登录但未加入家庭 */}
      {user && !household && (
        <View className='space-y-4'>
          <Card className='border-indigo-100 bg-indigo-50/40'>
            <CardContent className='p-4 flex justify-between items-center'>
              <View>
                <Text className='text-xs font-bold text-slate-700 block'>已登录</Text>
                <Text className='text-[10px] text-slate-400 block'>{user.email}</Text>
              </View>
              <Motion tapScale={0.95} onClick={handleLogout} className='text-[10px] text-slate-400 font-bold'>退出</Motion>
            </CardContent>
          </Card>

          {/* 创建家庭 */}
          <Card>
            <CardContent className='p-4 space-y-3'>
              <View className='flex items-center gap-1.5'>
                <Icon name='plus' size={14} className='text-indigo-600' />
                <Text className='text-sm font-bold text-slate-800'>创建家庭组</Text>
              </View>
              <Text className='text-[10px] text-slate-400 block'>创建后会生成6位匹配码，发给家人加入</Text>
              <View className='flex items-center bg-slate-100 rounded-xl px-3 py-2'>
                <Input
                  value={familyName}
                  onInput={(e) => setFamilyName(e.detail.value)}
                  placeholder='家庭名称（如：张家）'
                  className='flex-1 bg-transparent text-sm'
                />
              </View>
              <Motion
                tapScale={0.98}
                onClick={handleCreate}
                className='w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs text-center'
              >
                创建并生成匹配码
              </Motion>
            </CardContent>
          </Card>

          {/* 加入家庭 */}
          <Card>
            <CardContent className='p-4 space-y-3'>
              <View className='flex items-center gap-1.5'>
                <Icon name='user' size={14} className='text-emerald-600' />
                <Text className='text-sm font-bold text-slate-800'>加入家庭组</Text>
              </View>
              <Text className='text-[10px] text-slate-400 block'>输入家人分享给你的6位匹配码</Text>
              <View className='flex items-center bg-slate-100 rounded-xl px-3 py-2'>
                <Input
                  value={joinCode}
                  onInput={(e) => setJoinCode(e.detail.value.toUpperCase())}
                  placeholder='如：8K3K9P'
                  className='flex-1 bg-transparent text-sm font-mono font-bold tracking-widest'
                />
              </View>
              {familyErr && <Text className='text-[10px] text-rose-500 block'>{familyErr}</Text>}
              <Motion
                tapScale={0.98}
                onClick={handleJoin}
                className='w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs text-center'
              >
                加入家庭
              </Motion>
            </CardContent>
          </Card>
        </View>
      )}

      {/* 4. 已加入家庭 */}
      {user && household && (
        <View className='space-y-4'>
          <Card className='bg-gradient-to-br from-indigo-600 to-purple-600 border-0 text-white'>
            <CardContent className='p-5 pt-5'>
              <View className='flex items-center gap-1.5 text-indigo-100 text-xs font-bold'>
                <Icon name='checkCircle' size={13} /> {household.role === 'owner' ? '你创建的家庭' : '已加入家庭'}
              </View>
              <Text className='text-2xl font-black block mt-1'>{household.name}</Text>
              <View className='flex items-center justify-between mt-3 bg-white/15 rounded-xl p-3'>
                <View>
                  <Text className='text-[10px] text-indigo-100 block'>家庭匹配码</Text>
                  <Text className='text-xl font-black font-mono tracking-widest block'>{household.invite_code}</Text>
                </View>
                <Motion
                  tapScale={0.95}
                  onClick={handleCopy}
                  className={`px-3 py-2 rounded-lg text-xs font-bold ${copied ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-600'}`}
                >
                  {copied ? '✓ 已复制' : '复制'}
                </Motion>
              </View>
              <Text className='text-[10px] text-indigo-100 mt-2 block leading-relaxed'>
                💡 把匹配码发给家人，他们注册账号后输入此码即可加入。
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-4 space-y-2'>
              <Text className='text-xs font-bold text-slate-600 block'>家庭同步说明</Text>
              <Text className='text-[10px] text-slate-500 leading-relaxed block'>
                • 你和家人记的每一笔都会自动同步到这本共享账本{'\n'}
                • 任何成员记账，其他人打开 APP 即可看到{'\n'}
                • 标签、补记日期同样会同步{'\n'}
                • 删除记录会在全家设备同步删除
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='p-4 flex justify-between items-center'>
              <View>
                <Text className='text-xs font-bold text-slate-700 block'>当前账号</Text>
                <Text className='text-[10px] text-slate-400 block'>{user.email}</Text>
              </View>
              <Motion tapScale={0.95} onClick={handleLogout} className='text-[10px] text-slate-400 font-bold'>退出登录</Motion>
            </CardContent>
          </Card>
        </View>
      )}
    </View>
  );
}
