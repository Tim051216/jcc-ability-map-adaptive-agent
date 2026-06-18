from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

from fastapi import HTTPException

from app.schemas.resource import JavaRunRequest, JavaRunResponse


class JavaRunnerService:
    async def run(self, payload: JavaRunRequest) -> JavaRunResponse:
        source_code = (payload.source_code or "").strip()
        if not source_code:
            raise HTTPException(status_code=400, detail="source_code is required")

        class_name = (payload.class_name or "Main").strip() or "Main"
        if class_name != "Main":
            raise HTTPException(status_code=400, detail="Only Main class is supported in current demo")

        with tempfile.TemporaryDirectory(prefix="a3-java-run-") as temp_dir:
            workdir = Path(temp_dir)
            java_file = workdir / f"{class_name}.java"
            java_file.write_text(source_code, encoding="utf-8")

            compile_process = await asyncio.create_subprocess_exec(
                "javac",
                java_file.name,
                cwd=str(workdir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            compile_stdout, compile_stderr = await compile_process.communicate()
            compile_output = "\n".join(
                part for part in [compile_stdout.decode("utf-8", errors="ignore"), compile_stderr.decode("utf-8", errors="ignore")] if part
            ).strip()

            if compile_process.returncode != 0:
                return JavaRunResponse(
                    success=False,
                    compile_ok=False,
                    run_ok=False,
                    stdout="",
                    stderr=compile_output,
                    exit_code=compile_process.returncode,
                    compile_output=compile_output,
                )

            run_process = await asyncio.create_subprocess_exec(
                "java",
                "-cp",
                str(workdir),
                class_name,
                cwd=str(workdir),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdin_bytes = (payload.stdin or "").encode("utf-8")
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    run_process.communicate(stdin_bytes),
                    timeout=payload.timeout_seconds,
                )
            except asyncio.TimeoutError:
                run_process.kill()
                await run_process.communicate()
                return JavaRunResponse(
                    success=False,
                    compile_ok=True,
                    run_ok=False,
                    stdout="",
                    stderr=f"Java execution timed out after {payload.timeout_seconds} seconds",
                    exit_code=None,
                    compile_output=compile_output,
                )

            stdout = stdout_bytes.decode("utf-8", errors="ignore").strip()
            stderr = stderr_bytes.decode("utf-8", errors="ignore").strip()
            exit_code = run_process.returncode
            run_ok = exit_code == 0

            return JavaRunResponse(
                success=run_ok,
                compile_ok=True,
                run_ok=run_ok,
                stdout=stdout,
                stderr=stderr,
                exit_code=exit_code,
                compile_output=compile_output,
            )
