'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import ReadingPane from '@/components/layout/ReadingPane';
import { 
  Sparkles, Wand2, Compass, ArrowLeft, RefreshCw, ThumbsUp, ThumbsDown, 
  Star, Check, CloudUpload, Clock, Flame, BookOpen, Layers, Volume2, VolumeX, ShieldCheck
} from 'lucide-react';

export default function ZenReadView({ onBackToArticles }) {
  const { setSelectedDoc, switchView, showToast } = useApp();

  // 流程阶段: 'questions' (AI问答) -> 'drawing' (3D抽卡动画) -> 'cards' (解封卡牌) -> 'reading' (禅阅读)
  const [phase, setPhase] = useState('questions');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [isLoadingQ, setIsLoadingQ] = useState(true);

  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [readCardIds, setReadCardIds] = useState(new Set());
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

  const renderFlatGachaCard = (card) => {
    const rarityClass = card.rarity === 'SSR' ? 'gacha-card-ssr' : card.rarity === 'SR' ? 'gacha-card-sr' : 'gacha-card-r';
    const rarityColor = card.rarity === 'SSR' ? '#f59e0b' : card.rarity === 'SR' ? '#a855f7' : '#3b82f6';
    const isReadSession = readCardIds.has(card.cardId);

    return (
      <div
        key={card.cardId}
        className={`gacha-card-container ${isReadSession ? '' : rarityClass}`}
        onMouseMove={(e) => handleMouseMoveCard(e, card.cardId)}
        onMouseLeave={() => handleMouseLeaveCard(card.cardId)}
        onClick={() => {
          setSelectedCard(card);
          setReadCardIds(prev => new Set(prev).add(card.cardId));
          setPhase('reading');
        }}
        style={{
          padding: '14px 16px',
          borderRadius: '18px',
          cursor: 'pointer',
          transform: tiltStyle[card.cardId] || 'none',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: '14px',
          height: 'calc((100vh - 220px) / 2)',
          minHeight: '195px',
          maxHeight: '240px',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          background: isReadSession
            ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)'
            : undefined,
          border: isReadSession
            ? '1.5px solid rgba(52, 211, 153, 0.7)'
            : undefined,
          boxShadow: isReadSession
            ? '0 8px 24px rgba(16, 185, 129, 0.3)'
            : undefined,
          transition: 'all 0.3s ease'
        }}
      >
        <div style={{
          width: '36%',
          height: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
          background: isReadSession
            ? 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)'
            : card.rarity === 'SSR'
            ? 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #451a03 100%)'
            : card.rarity === 'SR'
            ? 'linear-gradient(135deg, #581c87 0%, #7e22ce 50%, #3b0764 100%)'
            : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #172554 100%)',
          border: isReadSession ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid rgba(255,255,255,0.15)',
          boxShadow: 'inset 0 0 15px rgba(0,0,0,0.3)'
        }}>
          {card.document.image_url ? (
            <>
              <img
                src={card.document.image_url}
                alt="Cover"
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isReadSession ? 'brightness(0.85) contrast(1.05)' : undefined }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              <div style={{ position: 'absolute', inset: 0, background: isReadSession ? 'linear-gradient(to top, rgba(6,78,59,0.85) 0%, transparent 70%)' : 'linear-gradient(to top, rgba(15,23,42,0.85) 0%, transparent 60%)' }} />
            </>
          ) : null}

          <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 3 }}>
            <span style={{
              padding: '2px 8px', borderRadius: '8px',
              background: isReadSession ? '#059669' : rarityColor, color: '#ffffff',
              fontSize: '11px', fontWeight: '900', letterSpacing: '0.05em',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
            }}>
              {card.rarity}
            </span>
          </div>

          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', padding: '6px', textAlign: 'center',
            zIndex: 2, pointerEvents: 'none'
          }}>
            <Sparkles size={22} style={{ color: isReadSession ? '#34d399' : rarityColor, filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))', marginBottom: '2px' }} />
            <span style={{ fontSize: '10px', fontWeight: '800', color: isReadSession ? '#34d399' : 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              {isReadSession ? '禅定领悟' : '灵感解封'}
            </span>
          </div>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minWidth: 0,
          padding: '2px 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {card.isInbox && (
                <span style={{
                  padding: '2px 7px', borderRadius: '6px',
                  background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  fontSize: '11px', fontWeight: '700'
                }}>
                  📥 收件箱
                </span>
              )}
              {isReadSession ? (
                <span style={{
                  padding: '2px 8px', borderRadius: '6px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff', border: '1px solid rgba(52, 211, 153, 0.6)',
                  fontSize: '10px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '3px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
                }}>
                  <Check size={12} /> 禅定已读
                </span>
              ) : card.isUnread ? (
                <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1px 6px', borderRadius: '6px', fontWeight: '700' }}>未读新文</span>
              ) : (
                <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1px 6px', borderRadius: '6px', fontWeight: '700' }}>经典重温</span>
              )}
            </div>
            <span style={{ fontSize: '12px', fontWeight: '800', color: isReadSession ? '#34d399' : rarityColor }}>
              契合度 {card.matchPercentage}
            </span>
          </div>

          <h3 style={{
            fontSize: '15px', fontWeight: '800', lineHeight: '1.35',
            color: isReadSession ? '#a7f3d0' : '#ffffff',
            margin: '0 0 6px 0', letterSpacing: '-0.01em',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            flexShrink: 0
          }}>
            {isReadSession ? `✓ ${card.document.title}` : card.document.title}
          </h3>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '2px 0 6px 0', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', color: isReadSession ? '#34d399' : '#c084fc', marginBottom: '3px' }}>
              <Sparkles size={12} style={{ color: isReadSession ? '#34d399' : '#c084fc' }} />
              <span>{isReadSession ? '已完结解封' : (card.reasonTitle || 'AI 推荐理由')}</span>
            </div>
            <p style={{
              fontSize: '11px', color: isReadSession ? 'rgba(167, 243, 208, 0.85)' : 'rgba(255, 255, 255, 0.8)', lineHeight: '1.45', margin: 0,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>
              {card.detailedReason || card.reason}
            </p>
          </div>

          <div style={{
            paddingTop: '6px', borderTop: isReadSession ? '1px solid rgba(52, 211, 153, 0.2)' : '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginTop: 'auto', flexShrink: 0
          }}>
            <span style={{
              fontSize: '11px', color: isReadSession ? 'rgba(167, 243, 208, 0.6)' : 'rgba(255,255,255,0.5)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '58%'
            }}>
              {card.document.author} • {card.document.reading_time}
            </span>
            <button style={{
              padding: '5px 14px', borderRadius: '14px', border: 'none',
              background: isReadSession ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)' : rarityColor,
              color: '#ffffff', fontSize: '11px', fontWeight: '700',
              cursor: 'pointer', flexShrink: 0,
              boxShadow: isReadSession ? '0 2px 10px rgba(16, 185, 129, 0.4)' : '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              {isReadSession ? '✓ 再次温习' : '开启阅读'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(circle at 50% 20%, #1e1b4b 0%, #0f172a 60%, #020617 100%)',
      color: '#ffffff',
      overflowY: phase === 'cards' ? 'hidden' : 'auto',
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
          {phase === 'full-reading' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setPhase('cards')}
                className="btn btn-ghost btn-sm"
                style={{ color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', background: 'rgba(192, 132, 252, 0.15)', padding: '4px 12px', borderRadius: '16px' }}
              >
                <ArrowLeft size={16} /> 返回禅阅读抽卡列表
              </button>
              <button
                onClick={() => setPhase('reading')}
                className="btn btn-ghost btn-sm"
                style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '13px' }}
              >
                返回要点
              </button>
            </div>
          ) : phase === 'reading' ? (
            <button
              onClick={() => setPhase('cards')}
              className="btn btn-ghost btn-sm"
              style={{ color: 'rgba(255, 255, 255, 0.9)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
            >
              <ArrowLeft size={16} /> 返回卡牌列表
            </button>
          ) : phase === 'cards' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setPhase('questions')}
                className="btn btn-ghost btn-sm"
                style={{ color: 'rgba(255, 255, 255, 0.75)', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <ArrowLeft size={16} /> 重选问答
              </button>
              <button
                onClick={onBackToArticles}
                className="btn btn-ghost btn-sm"
                style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}
              >
                退出禅阅读
              </button>
            </div>
          ) : (
            <button
              onClick={onBackToArticles}
              className="btn btn-ghost btn-sm"
              style={{ color: 'rgba(255, 255, 255, 0.75)', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={16} /> 返回文章库
            </button>
          )}
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

      {/* 阶段 3: 3D 卡牌展列与解封 (3+2 扁平化两行阵型，一屏全显) */}
      {phase === 'cards' && (
        <div style={{
          height: 'calc(100vh - 65px)',
          maxWidth: '1380px',
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}>
          {/* 顶栏标题区 */}
          <div style={{ textAlign: 'center', marginBottom: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: '#c084fc', fontWeight: '700', letterSpacing: '0.1em' }}>GACHA DRAW REVEAL</span>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '2px 0 4px 0' }}>抽卡完成！今日为你解封的灵感文章</h2>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>点击任意卡牌即可开启沉浸式禅阅读</p>
          </div>

          {/* 3+2 两行扁平化卡片阵型容器 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            flex: 1,
            justifyContent: 'center',
            minHeight: 0,
            width: '100%'
          }}>
            {/* 第一行: 前 3 张卡片 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: cards.length <= 3 ? `repeat(${cards.length}, 1fr)` : 'repeat(3, 1fr)',
              gap: '14px',
              width: '100%'
            }}>
              {cards.slice(0, 3).map(card => renderFlatGachaCard(card))}
            </div>

            {/* 第二行: 后 2 张卡片 (居中分布，宽度与第一行卡片保持一致) */}
            {cards.length > 3 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '14px',
                width: '100%'
              }}>
                {cards.slice(3, 5).map(card => (
                  <div key={card.cardId} style={{ width: 'calc((100% - 28px) / 3)' }}>
                    {renderFlatGachaCard(card)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 重新抽卡按钮 (固定最底部) */}
          <div style={{ textAlign: 'center', marginTop: '6px', flexShrink: 0 }}>
            <button
              onClick={() => setPhase('questions')}
              className="btn btn-ghost btn-sm"
              style={{ color: 'rgba(255,255,255,0.6)', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            >
              <RefreshCw size={13} /> 重新答题并再次抽卡
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

          {/* 极简 AI 文章核心精华凝练 */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.6) 0%, rgba(15, 23, 42, 0.7) 100%)',
            padding: '32px', borderRadius: '24px',
            border: '1px solid rgba(192, 132, 252, 0.25)', marginBottom: '48px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', color: '#c084fc', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} /> 💡 AI 极简核心金句与要点
              </h3>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
                禅意高度凝练
              </span>
            </div>

            {/* 极简核心文字摘要 (120~150字，支持多行与换行) */}
            <p style={{ fontSize: '15px', lineHeight: '1.8', color: 'rgba(255, 255, 255, 0.95)', marginBottom: '20px', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
              {selectedCard.zenSummary || (selectedCard.document.summary ? selectedCard.document.summary.slice(0, 150) + '...' : '暂无核心描述')}
            </p>

            {/* 突破性要点 Bullet 标签框 */}
            {selectedCard.zenBullets && selectedCard.zenBullets.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
                {selectedCard.zenBullets.map((bullet, bIdx) => (
                  <div key={bIdx} style={{
                    padding: '10px 14px', borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '13px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: '1.6',
                    whiteSpace: 'pre-line'
                  }}>
                    {bullet}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                需要查阅完整原正文或深入笔记高亮？
              </span>
              <button
                onClick={() => {
                  setSelectedDoc(selectedCard.document);
                  setPhase('full-reading');
                }}
                style={{
                  padding: '10px 24px', borderRadius: '20px', border: 'none',
                  background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)', color: '#ffffff',
                  fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)'
                }}
              >
                进入完整阅读器模式 →
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

      {/* 阶段 5: 禅阅读内置全功能正文阅读器 */}
      {phase === 'full-reading' && selectedCard && (
        <div style={{ flex: 1, width: '100%', height: 'calc(100vh - 70px)', background: 'var(--color-bg-primary)', position: 'relative' }}>
          <ReadingPane />
        </div>
      )}
    </div>
  );
}
