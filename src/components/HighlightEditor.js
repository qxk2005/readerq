import { useState } from 'react';
import TagInput from './TagInput';

export default function HighlightEditor({ highlight, onUpdate, onDelete, onClose, allTags = [] }) {
  const [note, setNote] = useState(highlight.note || '');
  const [tags, setTags] = useState(highlight.tags ? Object.keys(highlight.tags) : []);

  const handleSave = () => {
    const tagsObj = {};
    tags.forEach(t => tagsObj[t] = 1);
    
    // Auto-append readerq tag
    if (!tagsObj['readerq']) {
      tagsObj['readerq'] = 1;
    }
    
    onUpdate(highlight.id, { note, tags: tagsObj });
    onClose();
  };

  return (
    <div 
      className="highlight-toolbar" 
      style={{ 
        top: highlight.rect.top, 
        left: highlight.rect.left + highlight.rect.width / 2,
        flexDirection: 'column',
        width: '250px'
      }}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%'}}>
        <span style={{fontSize: '12px', color: 'var(--color-text-secondary)'}}>修改高亮</span>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      
      <div style={{display: 'flex', gap: '8px', padding: '4px 0'}}>
        {['yellow', 'green', 'blue', 'purple', 'red'].map(c => (
          <button 
            key={c}
            className="highlight-color-btn" 
            style={{
              backgroundColor: `var(--highlight-${c})`, 
              border: highlight.color === c ? '2px solid var(--color-text-primary)' : '1px solid rgba(0,0,0,0.1)'
            }} 
            onClick={() => onUpdate(highlight.id, { color: c })} 
          />
        ))}
      </div>

      <textarea 
        className="input" 
        placeholder="添加笔记..." 
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ width: '100%', minHeight: '60px', marginTop: '8px', padding: '8px', fontSize: '12px' }}
      />

      <div style={{ marginTop: '8px' }}>
        <TagInput 
          value={tags}
          onChange={setTags}
          allTags={allTags.map(t => t.name)}
          placeholder="添加标签..."
        />
      </div>

      <div style={{display: 'flex', gap: '8px', width: '100%', marginTop: '8px'}}>
        <button className="btn btn-primary btn-sm" style={{flex: 1}} onClick={handleSave}>
          保存修改
        </button>
        <button className="btn btn-ghost btn-sm" style={{color: 'var(--color-danger)'}} onClick={() => onDelete(highlight.id)}>
          🗑️
        </button>
      </div>
    </div>
  );
}
