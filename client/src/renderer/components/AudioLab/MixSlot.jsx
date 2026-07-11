import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * MixSlot Component
 * 
 * A self-contained mix slot with three distinct physical states:
 * 1. Idle (Empty): Dashed border, light background, "+ Add Sound" prompt
 * 2. Active (Popover): Floating mini-grid of owned sounds, positioned absolutely over UI
 * 3. Completed (Filled): Solid border, sound icon + name, muted clear button
 * 
 * State Management:
 * - Local `isOpen` boolean controls popover visibility
 * - Outside click listener auto-closes popover
 * - No dependency on global "assignment mode" state
 */
export function MixSlot({
  index,
  selectedSoundId,
  onAssign,
  onClear,
  onRemoveSlot,
  ownedSounds,
  getSlotLabel,
  getMusicName,
  totalFilledSlots = 1,
  totalSlots = 1,
}) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const slotRef = useRef(null);
  const popoverRef = useRef(null);

  // Get overlay color with opacity levels
  const overlayRgb = theme['overlay-rgb'] || '255,255,255';
  const overlayColor = (opacity) => `rgba(${overlayRgb}, ${opacity})`;

  // Icon helper (replicates IconMusic from parent)
  const IconMusic = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );

  const IconPlus = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );

  // Small ×  remove button shown in the top-right of every slot when totalSlots > 2
  const RemoveButton = () => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onRemoveSlot) onRemoveSlot();
      }}
      title="Remove this slot"
      style={{
        position: 'absolute',
        top: '6px',
        right: '6px',
        zIndex: 10,
        width: '20px',
        height: '20px',
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: overlayColor(0.15),
        border: `1px solid ${overlayColor(0.2)}`,
        borderRadius: '50%',
        cursor: 'pointer',
        color: 'var(--text3)',
        fontSize: '12px',
        lineHeight: 1,
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
        e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)';
        e.currentTarget.style.color = '#ef4444';
        e.currentTarget.style.transform = 'scale(1.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = overlayColor(0.15);
        e.currentTarget.style.borderColor = overlayColor(0.2);
        e.currentTarget.style.color = 'var(--text3)';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      ×
    </button>
  );

  // Outside click listener: close popover if click happens outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        slotRef.current &&
        !slotRef.current.contains(e.target) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    // Attach listener to the document
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSlotClick = () => {
    if (selectedSoundId) {
      // If already filled, toggle popover to allow replacement
      setIsOpen(!isOpen);
    } else {
      // If empty, open popover
      setIsOpen(true);
    }
  };

  const handleSoundSelect = (soundId) => {
    onAssign(soundId);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onClear();
    setIsOpen(false);
  };

  // ─── IDLE STATE (Empty Slot) ───
  if (!selectedSoundId) {
    return (
      <div
        ref={slotRef}
        className="audio-mix-slot audio-mix-slot--idle"
        onClick={handleSlotClick}
        style={{
          position: 'relative',
          border: `2px dashed ${overlayColor(0.3)}`,
          borderRadius: '14px',
          padding: '16px',
          background: overlayColor(0.04),
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          minHeight: '100px',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Remove button — only when more than 2 slots exist */}
        {totalSlots > 2 && <RemoveButton />}

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text3)' }}>
          <IconPlus />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Add Sound</span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text4)', textAlign: 'center' }}>
          Slot {getSlotLabel(index)}
        </div>

        {/* Popover: Mini-grid of owned sounds */}
        {isOpen && (
          <div
            ref={popoverRef}
            className="audio-mix-slot-popover"
            style={{
              position: 'absolute',
              top: '100%',
              left: '0',
              marginTop: '8px',
              background: 'var(--surface)',
              border: `1px solid ${overlayColor(0.12)}`,
              borderRadius: '14px',
              padding: '12px',
              zIndex: 1000,
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              minWidth: '280px',
              maxHeight: '300px',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text3)', marginBottom: '10px' }}>
              Select a sound
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
              }}
            >
              {ownedSounds.map(sound => (
                <button
                  key={sound.id}
                  onClick={() => handleSoundSelect(sound.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 8px',
                    background: overlayColor(0.06),
                    border: `1px solid ${overlayColor(0.1)}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    color: 'var(--text)',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = overlayColor(0.12);
                    e.target.style.borderColor = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = overlayColor(0.06);
                    e.target.style.borderColor = overlayColor(0.1);
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      background: sound.accent ? `${sound.accent}22` : overlayColor(0.08),
                      color: sound.accent || 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                    }}
                  >
                    <IconMusic />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, textAlign: 'center', lineHeight: '1.2' }}>
                    {sound.name}
                  </div>
                </button>
              ))}
            </div>

            {ownedSounds.length === 0 && (
              <div style={{ color: 'var(--text3)', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
                No sounds available
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── COMPLETED STATE (Filled Slot) ───
  const soundName = getMusicName(selectedSoundId);
  const sound = ownedSounds.find(s => s.id === selectedSoundId);

  return (
    <div
      ref={slotRef}
      className="audio-mix-slot audio-mix-slot--completed"
      onClick={handleSlotClick}
      style={{
        position: 'relative',
        border: `2px solid ${overlayColor(0.25)}`,
        borderRadius: '14px',
        padding: '16px',
        background: overlayColor(0.06),
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: '8px',
        minHeight: '100px',
        transition: 'all 0.2s ease',
        overflow: 'visible',
      }}
    >
      {/* Remove button — only when more than 2 slots exist */}
      {totalSlots > 2 && <RemoveButton />}

      {/* Sound icon and name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            background: sound?.accent ? `${sound.accent}22` : overlayColor(0.08),
            color: sound?.accent || 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            flexShrink: 0,
          }}
        >
          <IconMusic />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {soundName}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
            Slot {getSlotLabel(index)}
          </div>
        </div>
      </div>

      {/* Popover: Mini-grid for replacement */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="audio-mix-slot-popover"
          style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            marginTop: '8px',
            background: 'var(--surface)',
            border: `1px solid ${overlayColor(0.12)}`,
            borderRadius: '14px',
            padding: '12px',
            zIndex: 1000,
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
            minWidth: '280px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text3)', marginBottom: '10px' }}>
            Select a new sound
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}
          >
            {ownedSounds.map(sound => (
              <button
                key={sound.id}
                onClick={() => handleSoundSelect(sound.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 8px',
                  background: overlayColor(0.06),
                  border: `1px solid ${overlayColor(0.1)}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  color: 'var(--text)',
                  opacity: selectedSoundId === sound.id ? 0.6 : 1,
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (selectedSoundId !== sound.id) {
                    e.target.style.background = overlayColor(0.12);
                    e.target.style.borderColor = 'var(--accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedSoundId !== sound.id) {
                    e.target.style.background = overlayColor(0.06);
                    e.target.style.borderColor = overlayColor(0.1);
                  }
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    background: sound.accent ? `${sound.accent}22` : overlayColor(0.08),
                    color: sound.accent || 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                  }}
                >
                  <IconMusic />
                </div>
                <div style={{ fontSize: '11px', fontWeight: 600, textAlign: 'center', lineHeight: '1.2' }}>
                  {sound.name}
                </div>
                {selectedSoundId === sound.id && (
                  <div style={{ fontSize: '9px', color: 'var(--accent)', fontWeight: 700 }}>
                    Current
                  </div>
                )}
              </button>
            ))}
          </div>

          {ownedSounds.length === 0 && (
            <div style={{ color: 'var(--text3)', fontSize: '12px', textAlign: 'center', padding: '16px' }}>
              No sounds available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
