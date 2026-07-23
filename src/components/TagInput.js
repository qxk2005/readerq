import { useState, useRef, useEffect } from 'react';

export default function TagInput({ value, onChange, allTags = [], placeholder = '添加标签...' }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    
    if (!val.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Filter tags that match input but aren't already selected, and deduplicate
    const lowerVal = val.trim().toLowerCase();
    const uniqueTags = Array.from(new Set(allTags.filter(Boolean)));
    const matches = uniqueTags
      .filter(t => typeof t === 'string' && t.toLowerCase().includes(lowerVal) && !value.includes(t))
      .slice(0, 5); // Max 5 suggestions

    setSuggestions(matches);
    setSelectedIndex(matches.length > 0 ? 0 : -1);
    setShowSuggestions(matches.length > 0);
  };

  const addTag = (tagToAdd) => {
    const tag = tagToAdd.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tagToRemove) => {
    onChange(value.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && suggestions[selectedIndex]) {
        addTag(suggestions[selectedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (showSuggestions) {
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="tag-input-container" ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '4px', 
          padding: '6px',
          border: '1px solid var(--color-border)', 
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-bg-primary)',
          minHeight: '34px'
        }}
      >
        {(value || []).map((tag, idx) => (
          <span 
            key={`${tag}-${idx}`} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              backgroundColor: 'var(--color-bg-tertiary)', 
              padding: '2px 6px', 
              borderRadius: '4px',
              fontSize: '11px',
              color: 'var(--color-text-secondary)'
            }}
          >
            #{tag}
            <button 
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              style={{ background: 'none', border: 'none', marginLeft: '4px', cursor: 'pointer', opacity: 0.6, fontSize: '10px' }}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{ 
            flex: 1, 
            minWidth: '60px', 
            border: 'none', 
            outline: 'none', 
            background: 'transparent',
            fontSize: '12px',
            color: 'var(--color-text-primary)'
          }}
        />
      </div>

      {showSuggestions && (
        <ul 
          style={{ 
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            right: 0, 
            marginTop: '4px', 
            padding: '4px', 
            margin: 0,
            listStyle: 'none', 
            backgroundColor: 'var(--color-bg-card)', 
            border: '1px solid var(--color-border)', 
            borderRadius: 'var(--radius-md)', 
            boxShadow: 'var(--shadow-md)',
            zIndex: 1000,
            maxHeight: '150px',
            overflowY: 'auto'
          }}
        >
          {suggestions.map((suggestion, index) => (
            <li 
              key={`${suggestion}-${index}`}
              onClick={() => addTag(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              style={{ 
                padding: '6px 8px', 
                cursor: 'pointer', 
                fontSize: '12px',
                borderRadius: '4px',
                backgroundColor: index === selectedIndex ? 'var(--color-bg-tertiary)' : 'transparent',
                color: 'var(--color-text-primary)'
              }}
            >
              #{suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
