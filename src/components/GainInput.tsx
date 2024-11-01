import "./GainInput.scss";
import { useState } from "react";
import { round } from "../utils";

type Props = {
    unit: "dB" | "linear";
    gain: number;
    onAdjust?: (gain: number) => any;
    onChange?: (gain: number) => any;
    style?: React.CSSProperties;
};

const GainInput: React.FunctionComponent<Props> = ({ unit, gain, onAdjust, onChange, style }) => {
    const [editing, setEditing] = useState(false);
    const [dragged, setDragged] = useState(false);
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (editing) return;
        e.stopPropagation();
        e.preventDefault();
        setDragged(false);
        const originalGain = gain;
        let delta = 0;
        const originY = e.clientY;
        const handleMouseMove = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            setDragged(true);
            if (e.movementY) {
                delta = (originY - e.clientY) / (unit === "dB" ? 5 : 50);
                onAdjust?.(originalGain + delta);
            }
        };
        const handleMouseUp = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onChange?.(originalGain + delta);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("keydown", handleKeyDown);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                e.preventDefault();
                if (delta) onChange?.(originalGain);
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
                document.removeEventListener("keydown", handleKeyDown);
            }
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("keydown", handleKeyDown);
    };
    const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
        if (editing) return;
        if (dragged) return;
        const span = e.currentTarget;
        const oldText = span.innerText;
        span.contentEditable = "true";
        setEditing(true);
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(span);
        selection?.removeAllRanges();
        selection?.addRange(range);
        span.focus();
        const handleBlur = async (e?: FocusEvent) => {
            if (e) e.stopPropagation();
            span.removeEventListener("blur", handleBlur);
            span.removeEventListener("keydown", handleKeyDown);
            const newText = span.innerText;
            try {
                let gain = parseFloat(newText);
                if (isNaN(gain) || !isFinite(gain)) gain = +(unit === "linear");
                onAdjust?.(gain);
                onChange?.(gain);
            } catch (e) {
                span.innerText = oldText;
            } finally {
                span.contentEditable = "false";
                setEditing(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleBlur();
            }
            if (e.key === "Escape") {
                span.innerText = oldText;
                span.contentEditable = "false";
                setEditing(false);
                span.removeEventListener("blur", handleBlur);
                span.removeEventListener("keydown", handleKeyDown);
                span.blur();
            }
        };
        span.addEventListener("blur", handleBlur);
        span.addEventListener("keydown", handleKeyDown);
    };
    const classList = ["gain-input"];
    classList.push(unit === "dB" ? "gain-input-db" : "gain-input-linear");
    if (editing) classList.push("editing");
    return (
        <span className={classList.join(" ")} onClick={handleClick} onMouseDown={handleMouseDown} style={style}>
            {round(gain, 0.01) || 0}
        </span>
    );
};

export default GainInput;
