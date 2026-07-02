import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminLoginForm from "../AdminLoginForm";

const mockCallBack = vi.fn();

describe("AdminLoginForm", () => {

    beforeEach(() => {
        mockCallBack.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the admin login form", () => {
        render(<AdminLoginForm unlockAdmin={mockCallBack} />);
        const button = screen.getByRole('button', { name: /unlock admin/i });

        expect(button).toBeInTheDocument(); 

        expect(screen.getByLabelText(/admin secret/i)).toBeInTheDocument();
        expect(button).toHaveTextContent(/unlock admin/i);
    });

    it("calls the unlockAdmin callback on form submit", async () => {
        render(<AdminLoginForm unlockAdmin={mockCallBack} />);

        const passwordInput = screen.getByLabelText(/admin secret/i);
        const button = screen.getByRole("button", { name: /unlock admin/i });

        await userEvent.type(passwordInput, "test-password");
        await userEvent.click(button);

        expect(mockCallBack).toHaveBeenCalled();
    });
});