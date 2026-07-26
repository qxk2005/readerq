'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { 
  Sparkles, Wand2, Compass, ArrowLeft, RefreshCw, ThumbsUp, ThumbsDown, 
  Star, Check, CloudUpload, Clock, Flame, BookOpen, Layers, Volume2, VolumeX, ShieldCheck
} from 'lucide-react';

export default function ZenReadView({ onBackToArticles }) {
  const { setSelectedDoc, showToast } = useApp();

  // 流程阶段: 'questions' (AI问答) -> 'drawing' (3D抽卡动画) -> 'cards' (解封卡牌) -> 'reading' (禅阅读)
  const [phase, setPhase] = useState('questions');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [isLoadingQ, setIsLoadingQ] = useState(true);

  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // 反馈评分状态
  const [userRating, setUserRating] = useState(0); // 1~5
  const [userComment, setUserComment] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const [isSubmittingRate, setIsSubmittingRate] = useState(false);

  // 禅音背景氛围
  const [isZenSoundOn, setIsZenSoundOn] = useState(false);
  const [readTimeSeconds, setReadTimeSeconds] = useState(0);

  // 3D 卡牌倾斜 Hover 状态记录
  const [tiltStyle, setTiltStyle] = useState({});

  // 1. 获取 AI 禅意提问
  const fetchQuestions = useCallback(async () => {
    setIsLoadingQ(true);
    try {
      const res = await fetch('/api/zen-read/questions');
      const data = await res.json();
      if (data.questions) {
        setQuestions(data.questions);
      }
    } catch (e) {
      console.error('加载禅阅读提问失败:', e);
    } finally {
      setIsLoadingQ(false);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
    // 静默触发一次多端 OSS 同步下载
    fetch('/api/zen-read/sync').catch(() => {});
  }, [fetchQuestions]);

  // 计时器：沉浸阅读阶段
  useEffect(() => {
    let interval;
    if (phase === 'reading') {
      interval = setInterval(() => {
        setReadTimeSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setReadTimeSeconds(0);
    }
    return () => clearInterval(interval);
  }, [phase]);

  // 2. 选择答案
  const handleSelectOption = (questionId, option) => {
    const nextAnswers = { ...answers, [questionId]: option };
    setAnswers(nextAnswers);

    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
    }
  };

  // 3. 开始 3D 抽卡
  const handleStartDraw = async () => {
    setPhase('drawing');
    setIsDrawing(true);

    try {
      const res = await fetch('/api/zen-read/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, questions })
      });
      const data = await res.json();

      // 模拟 2.2 秒的 3D 卡池抽取动画
      setTimeout(() => {
        if (data.cards && data.cards.length > 0) {
          setCards(data.cards);
        }
        setIsDrawing(false);
        setPhase('cards');
      }, 2200);
    } catch (e) {
      console.error('抽卡推荐失败:', e);
      setIsDrawing(false);
      setPhase('questions');
      showToast('抽卡推荐失败，请重试', 'error');
    }
  };

  // 4. 选择某张解封卡牌进入禅阅读
  const handleOpenCardReading = (card) => {
    setSelectedCard(card);
    setHasRated(false);
    setUserRating(0);
    setUserComment('');
    setPhase('reading');
  };

  // 5. 提交阅读评价反馈
  const handleSubmitRating = async (ratingVal) => {
    if (!selectedCard || isSubmittingRate) return;
    setIsSubmittingRate(true);
    const finalRating = ratingVal || userRating || 5;

    try {
      const res = await fetch('/api/zen-read/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedCard.document.id,
          rating: finalRating,
          comment: userComment
        })
      });
      const data = await res.json();
      if (data.success) {
        setHasRated(true);
        setUserRating(finalRating);
        showToast('评价已保存并自动通过 OSS 同步至多端！', 'success');
      }
    } catch (e) {
      console.error('提交打分失败:', e);
    } finally {
      setIsSubmittingRate(false);
    }
  };

  // 3D 鼠标倾斜移动效果
  const handleMouseMoveCard = (e, cardId) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;

    setTiltStyle(prev => ({
      ...prev,
      [cardId]: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.04, 1.04, 1.04)`
    }));
  };

  const handleMouseLeaveCard = (cardId) => {
    setTiltStyle(prev => ({
      ...prev,
      [cardId]: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
    }));
  };

  const formatSeconds = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 60%, #020617 100%)',
      color: '#ffffff',
      overflowY: 'auto',
      position: 'relative',
      boxSizing: 'border-box'
    }}>
      {/* 局部 3D 发光样式与 CSSKeyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 25px rgba(139, 92, 246, 0.4); transform: scale(1); }
          50% { box-shadow: 0 0 45px rgba(139, 92, 246, 0.8); transform: scale(1.03); }
          100% { box-shadow: 0 0 25px rgba(139, 92, 246, 0.4); transform: scale(1); }
        }
        @keyframes cardSpinDraw {
          0% { transform: perspective(800px) rotateY(0deg) scale(0.5); opacity: 0; }
          50% { transform: perspective(800px) rotateY(540deg) scale(1.1); opacity: 0.9; }
          100% { transform: perspective(800px) rotateY(720deg) scale(1); opacity: 1; }
        }
        @keyframes floatParticle {
          0% { transform: translateY(0) rotate(0deg); opacity: 0.8; }
          50% { transform: translateY(-20px) rotate(180deg); opacity: 0.4; }
          100% { transform: translateY(0) rotate(360deg); opacity: 0.8; }
        }
        .gacha-card-container {
          transition: transform 0.2s ease-out, box-shadow 0.25s ease;
          transform-style: preserve-3d;
        }
        .gacha-card-ssr {
          border: 1px solid rgba(245, 158, 11, 0.8);
          background: linear-gradient(135deg, rgba(30, 27, 75, 0.9) 0%, rgba(120, 53, 15, 0.7) 100%);
          box-shadow: 0 10px 30px rgba(245, 158, 11, 0.25);
        }
        .gacha-card-sr {
          border: 1px solid rgba(168, 85, 247, 0.7);
          background: linear-gradient(135deg, rgba(30, 27, 75, 0.9) 0%, rgba(88, 28, 135, 0.7) 100%);
          box-shadow: 0 10px 30px rgba(168, 85, 247, 0.25);
        }
        .gacha-card-r {
          border: 1px solid rgba(59, 130, 246, 0.6);
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 58, 138, 0.6) 100%);
          box-shadow: 0 10px 30px rgba(59, 130, 246, 0.2);
        }
      ` }} />

      {/* 顶部 Header 导航条 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(12px)',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBackToArticles}
            className="btn btn-ghost btn-sm"
            style={{ color: 'rgba(255, 255, 255, 0.75)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={16} /> 返回列表
          </button>
          <div style={{ width: '1px', height: '16px', background: 'rgba(255, 255, 255, 0.15)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wand2 size={20} style={{ color: '#a855f7' }} />
            <span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '0.02em', background: 'linear-gradient(135deg, #ffffff 0%, #c084fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              禅阅读 AI 抽卡推荐
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* 多端 OSS 同步指示 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '12px' }}>
            <CloudUpload size={13} style={{ color: '#10b981' }} />
            <span>OSS 多端同步中</span>
          </div>
          {phase === 'reading' && (
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#c084fc', background: 'rgba(192, 132, 252, 0.15)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(192, 132, 252, 0.3)' }}>
              ⏱️ 禅定时间 {formatSeconds(readTimeSeconds)}
            </div>
          )}
        </div>
      </div>

      {/* 阶段 1: AI 禅意提问阶段 */}
      {phase === 'questions' && (
        <div style={{ maxWidth: '680px', margin: '60px auto 40px auto', padding: '0 20px', textAlign: 'center' }}>
          {isLoadingQ ? (
            <div style={{ padding: '80px 0', color: 'rgba(255,255,255,0.6)' }}>
              <div className="loading-spinner" style={{ width: '36px', height: '36px', margin: '0 auto 16px auto', borderColor: '#c084fc', borderTopColor: 'transparent' }} />
              <p style={{ fontSize: '15px' }}>AI 导师正在感应你最近的阅读脉络与心境...</p>
            </div>
          ) : questions.length === 0 ? (
            <div>提问初始化失败，请重试</div>
          ) : (
            <div>
              {/* 进度指示 */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    style={{
                      width: '40px', height: '4px', borderRadius: '2px',
                      background: idx === currentQIndex ? '#c084fc' : idx < currentQIndex ? 'rgba(192, 132, 252, 0.5)' : 'rgba(255, 255, 255, 0.15)',
                      transition: 'all 0.3s ease'
                    }}
                  />
                ))}
              </div>

              <span style={{ fontSize: '12px', fontWeight: '700', letterSpacing: '0.1em', color: '#a855f7', textTransform: 'uppercase' }}>
                AI PROBE QUESTION {currentQIndex + 1} OF {questions.length}
              </span>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '700', marginTop: '10px', marginBottom: '8px', lineHeight: '1.4' }}>
                {questions[currentQIndex]?.question}
              </h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '36px' }}>
                {questions[currentQIndex]?.subtitle}
              </p>

              {/* 选项列表 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {questions[currentQIndex]?.options.map(opt => {
                  const isSelected = answers[questions[currentQIndex].id]?.id === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelectOption(questions[currentQIndex].id, opt)}
                      style={{
                        padding: '16px 20px',
                        borderRadius: '16px',
                        border: isSelected ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.12)',
                        background: isSelected ? 'rgba(192, 132, 252, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: '500',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 0 20px rgba(192, 132, 252, 0.3)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check size={18} style={{ color: '#c084fc' }} />}
                    </button>
                  );
                })}
              </div>

              {/* 抽卡触发按钮 */}
              {Object.keys(answers).length >= questions.length && (
                <button
                  onClick={handleStartDraw}
                  style={{
                    marginTop: '40px',
                    padding: '14px 40px',
                    borderRadius: '30px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    animation: 'pulseGlow 2s infinite',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <Sparkles size={20} /> 开启 AI 炫酷抽卡仪式
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 阶段 2: 3D 抽卡法阵与仪式感阶段 */}
      {phase === 'drawing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '500px', textAlignment: 'center' }}>
          <div style={{
            width: '160px', height: '220px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #9333ea 0%, #ec4899 100%)',
            boxShadow: '0 0 60px rgba(168, 85, 247, 0.8)',
            animation: 'cardSpinDraw 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Wand2 size={48} style={{ color: '#ffffff' }} />
          </div>
          <h3 style={{ marginTop: '32px', fontSize: '18px', fontWeight: '700', letterSpacing: '0.05em', color: '#c084fc' }}>
            🔮 正在凝聚星芒，解封最契合你的灵感卡牌...
          </h3>
        </div>
      )}

      {/* 阶段 3: 3D 卡牌展列与解封 */}
      {phase === 'cards' && (
        <div style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: '700', letterSpacing: '0.1em' }}>GACHA DRAW REVEAL</span>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '6px 0 10px 0' }}>抽卡完成！今日为你解封的灵感文章</h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>点击任意卡牌即可开启沉浸式禅阅读</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {cards.map(card => {
              const rarityClass = card.rarity === 'SSR' ? 'gacha-card-ssr' : card.rarity === 'SR' ? 'gacha-card-sr' : 'gacha-card-r';
              const rarityColor = card.rarity === 'SSR' ? '#f59e0b' : card.rarity === 'SR' ? '#a855f7' : '#3b82f6';

              return (
                <div
                  key={card.cardId}
                  className={`gacha-card-container ${rarityClass}`}
                  onMouseMove={(e) => handleMouseMoveCard(e, card.cardId)}
                  onMouseLeave={() => handleMouseLeaveCard(card.cardId)}
                  onClick={() => handleOpenCardReading(card)}
                  style={{
                    padding: '24px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transform: tiltStyle[card.cardId] || 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '360px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* 稀有度 Badge 与契合度 */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: '12px',
                        background: rarityColor, color: '#ffffff',
                        fontSize: '12px', fontWeight: '900', letterSpacing: '0.05em'
                      }}>
                        {card.rarity}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: rarityColor }}>
                        契合度 {card.matchPercentage}
                      </span>
                    </div>

                    {/* AI 详细推荐理由面板 */}
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: 'rgba(255, 255, 255, 0.07)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      marginBottom: '16px',
                      backdropFilter: 'blur(8px)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#c084fc', marginBottom: '4px' }}>
                        <Sparkles size={13} />
                        <span>{card.reasonTitle || 'AI 深度推荐理由'}</span>
                        {card.isUnread ? (
                          <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '1px 6px', borderRadius: '8px', marginLeft: 'auto' }}>未读新文</span>
                        ) : (
                          <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '1px 6px', borderRadius: '8px', marginLeft: 'auto' }}>经典重温</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: '1.55' }}>
                        {card.detailedReason || card.reason}
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', lineHeight: '1.4', marginBottom: '12px', color: '#ffffff' }}>
                      {card.document.title}
                    </h3>

                    <p style={{
                      fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: '1.6',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {card.document.summary}
                    </p>
                  </div>

                  {/* 底部按钮 */}
                  <div style={{ paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                      {card.document.author} • {card.document.reading_time}
                    </span>
                    <button style={{
                      padding: '8px 18px', borderRadius: '20px', border: 'none',
                      background: rarityColor, color: '#ffffff', fontSize: '12px', fontWeight: '700',
                      cursor: 'pointer'
                    }}>
                      开启阅读
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <button
              onClick={() => setPhase('questions')}
              className="btn btn-ghost btn-sm"
              style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} /> 重新答题并再次抽卡
            </button>
          </div>
        </div>
      )}

      {/* 阶段 4: 沉浸式禅阅读与阶段 5 评分反馈 */}
      {phase === 'reading' && selectedCard && (
        <div style={{ maxWidth: '800px', margin: '40px auto 80px auto', padding: '0 24px' }}>
          {/* 阅读卡片头部 */}
          <div style={{
            padding: '24px', borderRadius: '20px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '32px'
          }}>
            <span style={{ fontSize: '12px', color: '#c084fc', fontWeight: '700' }}>
              {selectedCard.rarity} 级抽卡作品 • 契合度 {selectedCard.matchPercentage}
            </span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '800', marginTop: '8px', marginBottom: '12px', lineHeight: '1.35' }}>
              {selectedCard.document.title}
            </h1>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', display: 'flex', gap: '16px' }}>
              <span>作者: {selectedCard.document.author}</span>
              <span>字数: {selectedCard.document.word_count} 字</span>
            </div>
          </div>

          {/* 文章摘要/正文 */}
          <div style={{
            fontSize: '16px', lineHeight: '1.9', color: 'rgba(255, 255, 255, 0.9)',
            background: 'rgba(255, 255, 255, 0.02)', padding: '32px', borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '48px'
          }}>
            <h3 style={{ fontSize: '14px', color: '#c084fc', marginBottom: '12px', fontWeight: '700' }}>💡 文章核心精华</h3>
            <p>{selectedCard.document.summary}</p>
            <p style={{ marginTop: '20px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
              (点击下方全功能按钮，可直接跳转到完整原正文或在侧栏深入笔记高亮)
            </p>

            <div style={{ marginTop: '24px' }}>
              <button
                onClick={() => {
                  setSelectedDoc(selectedCard.document);
                }}
                style={{
                  padding: '10px 24px', borderRadius: '20px', border: 'none',
                  background: 'var(--color-accent)', color: '#ffffff',
                  fontSize: '14px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                进入完整阅读器模式
              </button>
            </div>
          </div>

          {/* 阶段 5: 阅读完毕后打分与评价反馈 */}
          <div style={{
            padding: '32px', borderRadius: '24px',
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(192, 132, 252, 0.3)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '6px' }}>
                🎉 完成这次禅阅读！请为本次推荐打分
              </h3>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                你的点赞/点踩与评分将反哺 AI 强化学习算法，并通过 OSS 实时同步到你的多端客户端。
              </p>
            </div>

            {hasRated ? (
              <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <ShieldCheck size={32} style={{ color: '#10b981', margin: '0 auto 8px auto' }} />
                <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', margin: 0 }}>
                  感谢反馈！AI 已更新偏好权重并完成多端云同步
                </h4>
              </div>
            ) : (
              <div>
                {/* 点赞点踩快捷按钮 */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '24px' }}>
                  <button
                    onClick={() => handleSubmitRating(5)}
                    style={{
                      padding: '12px 28px', borderRadius: '24px',
                      border: '1px solid rgba(16, 185, 129, 0.5)',
                      background: 'rgba(16, 185, 129, 0.15)', color: '#10b981',
                      fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                  >
                    <ThumbsUp size={18} /> 超赞推荐 (Like)
                  </button>
                  <button
                    onClick={() => handleSubmitRating(1)}
                    style={{
                      padding: '12px 28px', borderRadius: '24px',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                      fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '8px'
                    }}
                  >
                    <ThumbsDown size={18} /> 不太符合 (Dislike)
                  </button>
                </div>

                {/* 详细文字反馈 */}
                <div style={{ marginBottom: '20px' }}>
                  <input
                    type="text"
                    placeholder="输入简短反馈或想法（可选）..."
                    value={userComment}
                    onChange={(e) => setUserComment(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)',
                      color: '#ffffff', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
