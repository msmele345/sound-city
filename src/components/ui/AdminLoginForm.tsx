import React, { ReactElement } from 'react'
import SubmitButton from './SubmitButton';

interface AdminFormProps {
    unlockAdmin: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

const AdminLoginForm = ({unlockAdmin}: AdminFormProps): ReactElement => {
    return (
        <>
            <form
                aria-label="Unlock admin catalog"
                className="mt-8 max-w-xl border-b border-rule pb-6"
                onSubmit={unlockAdmin}
            >
                <label className="block font-mono text-[0.68rem] uppercase tracking-[0.16em] text-ink-faint">
                    Admin secret
                    <input
                        name="adminSecret"
                        required
                        type="password"
                        autoComplete="current-password"
                        className="mt-2 w-full border border-rule bg-bg px-3 py-2 font-sans text-sm normal-case tracking-normal text-ink"
                    />
                </label>
                <div className="mt-4">
                    <SubmitButton>Unlock admin</SubmitButton>
                </div>
            </form>
        </>
    );
};

export default AdminLoginForm;