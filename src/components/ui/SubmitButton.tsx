import { ReactElement } from "react";

type SubmitButtonProps = {
    children: React.ReactNode
}


const SubmitButton = ({children}: SubmitButtonProps): ReactElement => {
    return (
        <button
            type="submit"
            className="border border-rule px-3 py-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal transition-colors duration-150 hover:bg-panel hover:text-ink"
        >
            {children}
        </button>
    );
};

export default SubmitButton;