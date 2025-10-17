import React, { useState, useEffect } from 'react';

interface MetricCardProps {
    width: number;
    height: number;
    data?: number[][];  // Superset 传入的数据（可选）
    formData?: {
        defaultValue?: number;
        title?: string;
        valueColor?: string;
        backgroundColor?: string;
        fontSize?: number;
        allowInput?: boolean;
    };
}

const MetricCardWithInput: React.FC<MetricCardProps> = ({
    width,
    height,
    data,
    formData = {}
}) => {
    // 从 props 中提取配置
    const {
        defaultValue = 0,
        title = '请输入数字',
        valueColor = '#1890ff',
        backgroundColor = '#ffffff',
        fontSize = 72,
        allowInput = true
    } = formData;

    // 状态管理
    const [inputValue, setInputValue] = useState<string>('');
    const [displayValue, setDisplayValue] = useState<number>(defaultValue);

    // 如果有 Superset 数据，优先使用数据
    useEffect(() => {
        if (data && data[0] && data[0][0] !== undefined) {
            const dataValue = data[0][0];
            setDisplayValue(dataValue);
            setInputValue(dataValue.toString());
        }
    }, [data]);

    // 处理输入变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);

        // 只更新数字输入
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
            setDisplayValue(numValue);
        }
    };

    // 处理回车确认
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const numValue = parseFloat(inputValue);
            if (!isNaN(numValue)) {
                setDisplayValue(numValue);
            }
        }
    };

    return (
        <div
            style={{
                width,
                height,
                backgroundColor,
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: 'Arial, sans-serif'
            }}
        >
            {/* 标题 */}
            <div style={{
                fontSize: '18px',
                color: '#333',
                marginBottom: '20px',
                fontWeight: 'bold'
            }}>
                {title}
            </div>

            {/* 输入框 */}
            {allowInput && (
                <div style={{ marginBottom: '30px', width: '80%' }}>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyPress={handleKeyPress}
                        placeholder="输入数字..."
                        style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '16px',
                            border: '2px solid #ddd',
                            borderRadius: '4px',
                            textAlign: 'center',
                            outline: 'none',
                            transition: 'border-color 0.3s'
                        }}
                        onFocus={(e) => {
                            e.target.style.borderColor = valueColor;
                        }}
                        onBlur={(e) => {
                            e.target.style.borderColor = '#ddd';
                        }}
                    />
                    <div style={{
                        fontSize: '12px',
                        color: '#999',
                        marginTop: '5px',
                        textAlign: 'center'
                    }}>
                        按 Enter 确认修改
                    </div>
                </div>
            )}

            {/* 放大显示的数字 */}
            <div style={{
                fontSize: `${fontSize}px`,
                fontWeight: 'bold',
                color: valueColor,
                textAlign: 'center',
                lineHeight: 1,
                margin: '10px 0',
                textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
            }}>
                {displayValue.toLocaleString()}
            </div>

            {/* 数值信息 */}
            <div style={{
                fontSize: '14px',
                color: '#666',
                marginTop: '10px',
                textAlign: 'center'
            }}>
                {displayValue >= 1000000 ? `≈ ${(displayValue / 1000000).toFixed(1)} 百万` :
                    displayValue >= 1000 ? `≈ ${(displayValue / 1000).toFixed(1)} 千` :
                        `${displayValue} 单位`}
            </div>

            {/* 数据来源提示 */}
            <div style={{
                position: 'absolute',
                bottom: '10px',
                right: '15px',
                fontSize: '10px',
                color: '#ccc'
            }}>
                {data ? '数据源: 数据库' : '数据源: 手动输入'}
            </div>
        </div>
    );
};

export default MetricCardWithInput;

export const controlPanel = {
    controlPanelSections: [
        {
            label: '基本设置',
            expanded: true,
            controlSetRows: [
                [{
                    name: 'title',
                    config: {
                        type: 'TextControl',
                        label: '卡片标题',
                        default: '数字展示器',
                        description: '显示在顶部的标题'
                    }
                }],
                [{
                    name: 'defaultValue',
                    config: {
                        type: 'TextControl',
                        label: '默认数值',
                        default: '1000',
                        description: '初始显示的数字',
                        isInt: true
                    }
                }],
                [{
                    name: 'allowInput',
                    config: {
                        type: 'CheckboxControl',
                        label: '允许手动输入',
                        default: true,
                        description: '是否显示输入框让用户修改数值'
                    }
                }]
            ]
        },
        {
            label: '显示设置',
            expanded: true,
            controlSetRows: [
                [{
                    name: 'fontSize',
                    config: {
                        type: 'SliderControl',
                        label: '数字大小',
                        default: 72,
                        min: 24,
                        max: 120,
                        step: 4,
                        description: '主要数字的字体大小'
                    }
                }],
                [{
                    name: 'valueColor',
                    config: {
                        type: 'ColorPickerControl',
                        label: '数字颜色',
                        default: '#1890ff',
                        description: '主要数字的颜色'
                    }
                }],
                [{
                    name: 'backgroundColor',
                    config: {
                        type: 'ColorPickerControl',
                        label: '背景颜色',
                        default: '#ffffff',
                        description: '卡片的背景颜色'
                    }
                }]
            ]
        }
    ]
};