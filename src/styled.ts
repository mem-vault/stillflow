import styled, { css } from "styled-components";
import React from 'react'; // 导入 React

export const SectionTitle = styled.h2`
    font-size: 1.25rem;
    color: var(--primary-accent);
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
`;

export const Flex = styled.div.attrs<{
    $gap?: 0 | 2 | 4 | 8 | 16 | 32 | 64 | string;
    $direction?: "row" | "column" | string;
    $grow?: number;
}>(props => ({
    $gap: props.$gap || 0,
    $direction: props.$direction || "column",
    $grow: props.$grow,
}))`
    display: flex;
    flex-direction: ${(props) => props.$direction};
    ${(props) => props.$grow && css`
        flex-grow: ${props.$grow};
    `}
    gap: ${(props) => {
        if (typeof props.$gap === "string") {
            return props.$gap;
        } else if (typeof props.$gap === "number") {
            return `${props.$gap * 0.25}rem`;
        }
        return '0';
    }};
`;

export const Container = styled(Flex).attrs<{ $maxWidth?: string; $bordered?: boolean }>(props => ({
    $direction: props.$direction || "column",
    $gap: props.$gap || 8,
    $maxWidth: props.$maxWidth || '100%',
    $bordered: props.$bordered || false,
}))`
    width: 100%;
    max-width: ${(props) => props.$maxWidth};
    padding: ${(props) => (props.$bordered ? '1.5rem' : '0')};
    border: ${(props) => (props.$bordered ? `1px solid var(--border-color)` : 'none')};
    border-radius: ${(props) => (props.$bordered ? '8px' : '0')};
    background-color: ${(props) => (props.$bordered ? 'var(--background-secondary)' : 'transparent')};
    box-sizing: border-box;
`;

export const Title = styled.h1.attrs<{
    $bordered?: boolean
}>((props) => ({
    $bordered: props.$bordered || false,
}))`
    font-size: 1.85rem;
    color: var(--primary-accent);
    margin-bottom: 1.75rem;
    font-weight: 600;
    ${props => props.$bordered && css`
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 1.5rem;
    `}
`;

export const Button = styled.button.attrs<{ $primary?: boolean }>(props => ({
    $primary: props.$primary || false,
}))`
    font-size: 1rem;
    font-weight: 500;
    ${props => props.$primary ? css`
        color: var(--button-primary-text, var(--background));
        background-color: var(--button-primary-bg, var(--primary-accent));
        border: 1px solid var(--button-primary-bg, var(--primary-accent));
    ` : css`
        color: var(--button-text, var(--primary-accent));
        background-color: transparent;
        border: 1px solid var(--button-border, var(--primary-accent));
    `}
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    text-align: center;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out, border-color 0.2s ease-in-out, transform 0.1s ease-in-out;

    &:hover {
        ${props => props.$primary ? css`
            background-color: var(--button-primary-hover-bg, var(--secondary-accent));
            border-color: var(--button-primary-hover-bg, var(--secondary-accent));
        ` : css`
            background-color: var(--button-hover-bg, rgba(39, 221, 251, 0.1));
            color: var(--secondary-accent);
            border-color: var(--secondary-accent);
        `}
    }

    &:active {
        transform: translateY(1px);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background-color: ${props => props.$primary ? 'var(--button-primary-bg, var(--primary-accent))' : 'transparent'};
        border-color: ${props => props.$primary ? 'var(--button-primary-bg, var(--primary-accent))' : 'var(--button-border, var(--primary-accent))'};
    }
`;

export const LockItem = styled(Button)`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    padding: 1rem;
`;

export const Actions = styled.div`
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-top: auto;
    width: 100%;

    & > ${Button}, & > button {
        flex-grow: 1;
        &:not(:last-child) {
             margin-right: ${props => React.Children.count(props.children) > 1 ? '0.5rem' : '0'};
        }
    }
`;

export const ModalOverlay = styled.div`
    position: fixed;
    inset: 0;
    background-color: rgba(0, 9, 24, 0.88);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(3px);
    padding: 1rem;
`;

export const ModalContent = styled(Flex).attrs({
    $direction: "column",
})`
    gap: 1.5rem;
    background-color: var(--background-secondary);
    padding: 2rem;
    border-radius: 8px;
    border: 1px solid var(--border-color);
    width: 100%;
    max-width: 480px;
    box-shadow: 0 10px 30px rgba(var(--primary-accent-rgb, 39, 221, 251), 0.15);
    color: var(--foreground);

    h2 {
        color: var(--primary-accent);
        font-size: 1.6rem;
        font-weight: 600;
        margin: 0 0 0.5rem 0;
        text-align: center;
    }
`;

export const Input = styled.input`
    width: 100%;
    padding: 0.8rem 1rem;
    border: 1px solid var(--input-border, var(--border-color));
    border-radius: 6px;
    box-sizing: border-box;
    color: var(--foreground);
    background-color: var(--input-background, transparent);
    font-size: 1rem;
    transition: border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;

    &:focus {
        border-color: var(--secondary-accent);
        outline: none;
        box-shadow: 0 0 0 3px rgba(var(--secondary-accent-rgb, 41, 224, 244), 0.3);
    }

    &::placeholder {
        color: rgba(var(--foreground-rgb, 224, 231, 255), 0.6);
    }

    &:disabled {
        opacity: 0.6;
        background-color: rgba(var(--foreground-rgb, 224, 231, 255), 0.05);
    }
`;