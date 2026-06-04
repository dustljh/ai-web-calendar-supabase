import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Field, FieldGroup, FieldLabel, FieldSet, Input } from "@/components/ui/index";
import { useAuthStore } from "@/storage/User";
import { useEffect, useState } from "react";
import { toast } from "sonner";

//로그인 스키마 정의 (email 형식 및 비밀번호 자릿수 확인)
const formSchema = z.object({
  email: z.string().email("올바른 형식의 이메일 주소를 입력해주세요."),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다."),
});

type LoginFormValues = z.infer<typeof formSchema>;

function SignIn() {
  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);

  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });


  useEffect(() => {
    form.reset({
      email: "",
      password: "",
    });
  }, []);

  //로그인 제출 함수
  const handleSignIn = async (data: LoginFormValues) => {

    if (isLoading) {
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch("https://ai-web-calendar-supabase.onrender.com/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        })
      })
      const result = await response.json();

      if (result.status === "success" && result.user) {
        toast.success("로그인 성공!");

        setUser({
          id: result.user.id,
          email: result.user.email,
        });

        navigate("/");
      }
      else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("서버 연결 실패");
    }
    finally {
      setIsLoading(false);
    }

  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-[#f9fafb]">

      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#10B981]/10 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-3xl" />

      <form
        onSubmit={form.handleSubmit(handleSignIn)}
        className="relative z-10 flex flex-col items-center w-full max-w-md h-auto bg-gray-100 border border-black shadow-2xl p-10 rounded-2xl"
      >
        <h1 className="cursor-pointer font-extrabold text-2xl text-gray-900 tracking-tight mb-8"
          onClick={() => navigate("/")}>
          Plan B <span className="text-[#10B981]">AI</span><br />
        </h1>
        <div className="w-full max-w-xs">
          <FieldSet>
            <FieldGroup className="space-y-4">
              {/* 이메일 필드 */}
              <Field>
                <FieldLabel htmlFor="email">이메일</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  className="focus:border-[#10B981]"
                  placeholder="이메일을 입력하세요."
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </Field>

              {/* 비밀번호 필드 */}
              <Field>
                <FieldLabel htmlFor="password" >비밀번호</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  className="focus:border-[#10B981]"
                  placeholder="비밀번호를 입력하세요."
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-red-500 mt-1">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </Field>
            </FieldGroup>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-8 w-full bg-[#10B981] hover:bg-[#059669]
                disabled:bg-gray-400
                disabled:cursor-not-allowed
                active:scale-[0.98] text-white py-3 rounded-lg font-bold transition-all shadow-lg shadow-[#10B981]/20"
            >
              {isLoading ? "서버 연결 중..." : "로그인"}
            </button>
          </FieldSet>

          <div className="mt-6 text-center text-sm text-gray-500">
            아직 계정이 없으신가요? <a href="#" className="text-[#10B981] hover:underline" onClick={() => { navigate("/sign-up") }}>회원가입</a>
          </div>
        </div>
      </form>
    </div>
  );
}

export default SignIn;