import "./LevelMeter.scss";
import { useCallback, useEffect, useRef, useState } from "react";
import PeakAnalyserNode from "../worklets/PeakAnalyserNode";
import { atodb, setCanvasToFullSize } from "../utils";
import { VisualizationStyleOptions } from "../types";

type Props = Pick<VisualizationStyleOptions, "gridRulerColor" | "gridColor" | "textColor" | "monospaceFont"> & {
    numberOfChannels: number;
    peakAnalyserNode: PeakAnalyserNode;
    gain: number;
    showRuler?: boolean;
    onGainChange?: (gain: number) => any;
    frameRate?: number;
    minDB?: number;
    maxDB?: number;
    windowSize: number[];
};
const FRAME_RATE = 60;
const MIN_DB = -70;
const MAX_DB = 6;

const LevelMeter: React.FunctionComponent<Props> = ({ numberOfChannels, peakAnalyserNode, gain, showRuler = true, onGainChange, frameRate = FRAME_RATE, minDB = MIN_DB, maxDB = MAX_DB, windowSize, gridColor, gridRulerColor, textColor, monospaceFont }) => {
    const [values, setValues] = useState<number[]>([]);
    const [maxValues, setMaxValues] = useState<number[]>([]);
    const maxValuesRef = useRef<number[]>([]);
    const rafRef = useRef(-1);
    const canvasMeterRef = useRef<HTMLCanvasElement>(null);
    const canvasGridRef = useRef<HTMLCanvasElement>(null);
    const previousRafTimeRef = useRef(-1);
    const maxTimerRef = useRef(-1);
    const paintGrid = useCallback(() => {
        if (!showRuler) return;
        const canvas = canvasGridRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const [width, height] = setCanvasToFullSize(canvas);
        if (width <= 0 || height <= 0) return;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = gridRulerColor;
        ctx.fillStyle = textColor;
        ctx.font = `12px ${monospaceFont}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("dB", 10, 6);
        ctx.beginPath();
        let x: number;
        for (let db = -60; db <= maxDB; db += (width > 250 ? 1 : width > 100 ? 3 : 12)) {
            x = (db - minDB) / (maxDB - minDB) * width;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, db % 6 === 0 ? 4 : 2);
            if (db % (width > 250 ? 6 : width > 100 ? 12 : 36) === 0) ctx.fillText(db.toString(), x, 6);
        }
        ctx.stroke();
    }, [gridRulerColor, maxDB, minDB, monospaceFont, showRuler, textColor]);
    const paint = useCallback(() => {
        const canvas = canvasMeterRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const coldColor = "rgb(12, 248, 100)";
        const warmColor = "rgb(195, 248, 100)";
        const hotColor = "rgb(255, 193, 10)";
        const overloadColor = "rgb(255, 10, 10)";

        const [width, height] = setCanvasToFullSize(canvas);

        ctx.clearRect(0, 0, width, height);
        if (width <= 0 || height <= 0) return;
        const channels = values.length;
        const clipValue = 0;
        const channelHeight = (height + 1) / channels - 1;
        let x: number;
        let y = 0;
        let v: number;
        let histMax: number;
        ctx.fillStyle = gridColor;
        for (let channel = 1; channel < channels; channel++) {
            ctx.fillRect(0, channel * (channelHeight + 1) - 1, width, 1);
        }
        if (minDB >= clipValue || clipValue >= maxDB) {
            const fgColor = minDB >= clipValue ? overloadColor : coldColor;
            ctx.fillStyle = fgColor;
            for (let channel = 0; channel < channels; channel++) {
                v = values[channel];
                x = Math.max(0, Math.min(1, (v - minDB) / (maxDB - minDB))) * width;
                if (x > 0) ctx.fillRect(0, y, x, channelHeight);
                histMax = maxValues[channel];
                if (typeof histMax === "number" && histMax > v) {
                    x = Math.max(0, Math.min(1, (histMax - minDB) / (maxDB - minDB))) * width;
                    ctx.fillRect(Math.min(width - 1, x), y, 1, channelHeight);
                }
                y += channelHeight + 1;
            }
        } else {
            const clipX = Math.max(0, Math.min(1, (clipValue - minDB) / (maxDB - minDB))) * width;
            const clipWidth = width - clipX;
            const hotStop = width - clipWidth;
            const warmStop = hotStop - 1;
            const gradient = ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(0, coldColor);
            gradient.addColorStop(warmStop / width, warmColor);
            gradient.addColorStop(hotStop / width, hotColor);
            gradient.addColorStop(1, overloadColor);
            ctx.fillRect(warmStop, 0, 1, height);
            ctx.fillStyle = gradient;
            x = 0;
            y = 0;
            for (let channel = 0; channel < channels; channel++) {
                v = values[channel];
                x = Math.max(0, Math.min(1, (v - minDB) / (maxDB - minDB))) * width;
                if (x > 0) ctx.fillRect(0, y, Math.min(warmStop, x), channelHeight);
                if (x > clipX) ctx.fillRect(hotStop, y, Math.min(clipWidth, x - clipX), channelHeight);
                histMax = maxValues[channel];
                if (typeof histMax === "number" && histMax > v) {
                    x = Math.max(0, Math.min(1, (histMax - minDB) / (maxDB - minDB))) * width;
                    if (x <= clipX) ctx.fillRect(x, y, 1, channelHeight);
                    else ctx.fillRect(Math.min(width - 1, x), y, 1, channelHeight);
                }
                y += channelHeight + 1;
            }
        }
        // if (audioEditor.state.playing === "playing") schedulePaint();
        // rafRef.current = requestAnimationFrame(scheduleUpdate);
    }, [values, gridColor, minDB, maxDB, maxValues]);
    const scheduleUpdate = useCallback(async (time: number) => {
        if (time - previousRafTimeRef.current < 1000 / frameRate) {
            rafRef.current = requestAnimationFrame(scheduleUpdate);
            return;
        }
        const absMax = await peakAnalyserNode.getPeakSinceLastGet();
        const newValues = absMax?.length ? absMax.map(atodb) : new Array<number>(numberOfChannels).fill(minDB);
        const maxTimeoutCallback = () => {
            maxTimerRef.current = -1;
            maxValuesRef.current = new Array<number>(numberOfChannels).fill(minDB);
            setMaxValues(maxValuesRef.current);
        };
        if (newValues.find((v, i) => typeof maxValuesRef.current[i] === "undefined" || v > maxValuesRef.current[i])) {
            maxValuesRef.current = newValues.slice();
            setMaxValues(maxValuesRef.current);
            if (maxTimerRef.current !== -1) window.clearTimeout(maxTimerRef.current);
            maxTimerRef.current = window.setTimeout(maxTimeoutCallback, 1000);
        } else if (newValues.find((v, i) => v < maxValuesRef.current[i]) && maxTimerRef.current === -1) {
            maxTimerRef.current = window.setTimeout(maxTimeoutCallback, 1000);
        }
        setValues(values => newValues.length !== values.length || newValues.find((v, i) => v !== values[i]) ? newValues : values);
        rafRef.current = requestAnimationFrame(scheduleUpdate);
    }, [frameRate, minDB, numberOfChannels, peakAnalyserNode]);
    useEffect(() => {
        rafRef.current = requestAnimationFrame(scheduleUpdate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [scheduleUpdate]);
    useEffect(paint, [paint, windowSize]);
    useEffect(paintGrid, [showRuler, paintGrid, windowSize]);
    return (
        <div className={`meter-container${showRuler ? " meter-container-show-ruler" : ""}`}>
            <canvas ref={canvasMeterRef} />
            {showRuler ? <canvas ref={canvasGridRef} /> : null}
        </div>
    );
};

export default LevelMeter;
