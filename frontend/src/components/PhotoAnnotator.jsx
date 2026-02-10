import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Pencil, ArrowUpRight, Circle, Square, Type, 
  Undo, Redo, Save, X, Trash2, Minus, Plus
} from 'lucide-react';

const COLORS = [
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Blue', value: '#3B82F6' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' }
];

const TOOLS = [
  { id: 'freehand', icon: Pencil, name: 'Draw' },
  { id: 'arrow', icon: ArrowUpRight, name: 'Arrow' },
  { id: 'circle', icon: Circle, name: 'Circle' },
  { id: 'rectangle', icon: Square, name: 'Rectangle' },
  { id: 'text', icon: Type, name: 'Text' }
];

const PhotoAnnotator = ({ 
  imageUrl, 
  photoId, 
  initialAnnotations = [], 
  onSave, 
  onClose 
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [tool, setTool] = useState('freehand');
  const [color, setColor] = useState('#EF4444');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [annotations, setAnnotations] = useState(initialAnnotations);
  const [currentPath, setCurrentPath] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [history, setHistory] = useState([initialAnnotations]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [textPosition, setTextPosition] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);

  const drawArrow = useCallback((ctx, fromX, fromY, toX, toY, arrowColor) => {
    const headLength = 15;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.strokeStyle = arrowColor;
    ctx.fillStyle = arrowColor;
    
    // Line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }, []);

  const redrawCanvas = useCallback((img, width, height, currentScale, currentAnnotations) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    
    // Draw image
    ctx.drawImage(img, 0, 0, width, height);
    
    // Draw annotations
    currentAnnotations.forEach(ann => {
      ctx.strokeStyle = ann.color;
      ctx.fillStyle = ann.color;
      ctx.lineWidth = ann.strokeWidth || 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      switch (ann.type) {
        case 'freehand':
          if (ann.points && ann.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(ann.points[0].x * currentScale, ann.points[0].y * currentScale);
            ann.points.forEach(point => {
              ctx.lineTo(point.x * currentScale, point.y * currentScale);
            });
            ctx.stroke();
          }
          break;
          
        case 'arrow':
          drawArrow(ctx, 
            ann.startX * currentScale, ann.startY * currentScale, 
            ann.endX * currentScale, ann.endY * currentScale, 
            ann.color
          );
          break;
          
        case 'circle':
          ctx.beginPath();
          const radiusX = Math.abs(ann.endX - ann.startX) * currentScale / 2;
          const radiusY = Math.abs(ann.endY - ann.startY) * currentScale / 2;
          const centerX = (ann.startX + (ann.endX - ann.startX) / 2) * currentScale;
          const centerY = (ann.startY + (ann.endY - ann.startY) / 2) * currentScale;
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
          
        case 'rectangle':
          ctx.strokeRect(
            ann.startX * currentScale, 
            ann.startY * currentScale, 
            (ann.endX - ann.startX) * currentScale, 
            (ann.endY - ann.startY) * currentScale
          );
          break;
          
        case 'text':
          ctx.font = `${(ann.fontSize || 16) * currentScale}px Arial`;
          ctx.fillText(ann.text, ann.x * currentScale, ann.y * currentScale);
          break;
        default:
          break;
      }
    });
  }, [drawArrow]);

  // Load image and set canvas size
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const maxWidth = container.clientWidth - 40;
      const maxHeight = window.innerHeight - 200;
      
      let width = img.width;
      let height = img.height;
      
      // Scale down if too large
      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }
      if (height > maxHeight) {
        const ratio = maxHeight / height;
        height = maxHeight;
        width = width * ratio;
      }
      
      const newScale = width / img.width;
      setImageSize({ width, height, naturalWidth: img.width, naturalHeight: img.height });
      setScale(newScale);
      
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
        redrawCanvas(img, width, height, newScale, annotations);
      }
    };
    img.src = imageUrl;
  }, [imageUrl, redrawCanvas, annotations]);

  // Redraw canvas when annotations change
  useEffect(() => {
    if (imageSize.width > 0) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => redrawCanvas(img, imageSize.width, imageSize.height, scale, annotations);
      img.src = imageUrl;
    }
  }, [annotations, imageUrl, imageSize, scale, redrawCanvas]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    return { x, y };
  };

  const handleMouseDown = (e) => {
    const coords = getCanvasCoords(e);
    
    if (tool === 'text') {
      setTextPosition(coords);
      return;
    }
    
    setIsDrawing(true);
    setStartPoint(coords);
    
    if (tool === 'freehand') {
      setCurrentPath([coords]);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing) return;
    
    const coords = getCanvasCoords(e);
    
    if (tool === 'freehand') {
      setCurrentPath(prev => [...prev, coords]);
      
      // Draw current stroke in real-time
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (currentPath.length > 0) {
        const lastPoint = currentPath[currentPath.length - 1];
        ctx.beginPath();
        ctx.moveTo(lastPoint.x * scale, lastPoint.y * scale);
        ctx.lineTo(coords.x * scale, coords.y * scale);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = (e) => {
    if (!isDrawing) return;
    
    const coords = getCanvasCoords(e);
    let newAnnotation = null;
    
    switch (tool) {
      case 'freehand':
        if (currentPath.length > 1) {
          newAnnotation = {
            type: 'freehand',
            points: [...currentPath, coords],
            color,
            strokeWidth
          };
        }
        break;
        
      case 'arrow':
      case 'circle':
      case 'rectangle':
        if (startPoint) {
          newAnnotation = {
            type: tool,
            startX: startPoint.x,
            startY: startPoint.y,
            endX: coords.x,
            endY: coords.y,
            color,
            strokeWidth
          };
        }
        break;
    }
    
    if (newAnnotation) {
      const newAnnotations = [...annotations, newAnnotation];
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
    }
    
    setIsDrawing(false);
    setCurrentPath([]);
    setStartPoint(null);
  };

  const handleTextSubmit = () => {
    if (textInput && textPosition) {
      const newAnnotation = {
        type: 'text',
        x: textPosition.x,
        y: textPosition.y,
        text: textInput,
        color,
        fontSize: 16
      };
      
      const newAnnotations = [...annotations, newAnnotation];
      setAnnotations(newAnnotations);
      addToHistory(newAnnotations);
      
      setTextInput('');
      setTextPosition(null);
    }
  };

  const addToHistory = (newAnnotations) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newAnnotations);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAnnotations(history[historyIndex + 1]);
    }
  };

  const clearAll = () => {
    setAnnotations([]);
    addToHistory([]);
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave(annotations);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      {/* Toolbar */}
      <div className="bg-gray-900 border-b border-gray-700 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tools */}
          <div className="flex items-center space-x-1">
            {TOOLS.map(t => (
              <Button
                key={t.id}
                variant={tool === t.id ? 'default' : 'ghost'}
                size="sm"
                className={tool === t.id ? 'bg-orange-600' : 'text-gray-300 hover:text-gray-900'}
                onClick={() => setTool(t.id)}
                title={t.name}
              >
                <t.icon className="w-4 h-4" />
              </Button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex items-center space-x-1">
            {COLORS.map(c => (
              <button
                key={c.value}
                className={`w-6 h-6 rounded-full border-2 ${
                  color === c.value ? 'border-white scale-110' : 'border-gray-600'
                }`}
                style={{ backgroundColor: c.value }}
                onClick={() => setColor(c.value)}
                title={c.name}
              />
            ))}
          </div>

          {/* Stroke Width */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-300"
              onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
            >
              <Minus className="w-4 h-4" />
            </Button>
            <span className="text-gray-900 text-sm w-6 text-center">{strokeWidth}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-300"
              onClick={() => setStrokeWidth(Math.min(10, strokeWidth + 1))}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-300"
              onClick={undo}
              disabled={historyIndex === 0}
            >
              <Undo className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-300"
              onClick={redo}
              disabled={historyIndex === history.length - 1}
            >
              <Redo className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400"
              onClick={clearAll}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Save/Close */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleSave}
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-auto p-4"
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="cursor-crosshair rounded shadow-2xl"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => setIsDrawing(false)}
          />
          
          {/* Text Input Overlay */}
          {textPosition && (
            <div 
              className="absolute"
              style={{ 
                left: textPosition.x * scale, 
                top: textPosition.y * scale - 30 
              }}
            >
              <div className="flex items-center space-x-2 bg-white rounded shadow-lg p-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Enter text..."
                  className="px-2 py-1 border rounded text-sm w-40"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTextSubmit();
                    if (e.key === 'Escape') setTextPosition(null);
                  }}
                />
                <Button size="sm" onClick={handleTextSubmit}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTextPosition(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-2 flex justify-between text-sm text-gray-600">
        <span>Tool: {TOOLS.find(t => t.id === tool)?.name}</span>
        <span>{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};

// Missing Check icon - add it
const Check = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export default PhotoAnnotator;
