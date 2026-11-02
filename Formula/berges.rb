class Berges < Formula
  desc "Berges AI as an agent in your terminal, built on pi"
  homepage "https://berges.ai/help/use-berges-ai-in-your-terminal"
  url "https://github.com/bergesinstitute/homebrew-tap/archive/refs/tags/berges-v0.1.0.tar.gz"
  sha256 "45a386fdfc79602c781ddb494696ee07a8da7ac0148d0d78243c440fe217cbeb"
  head "https://github.com/bergesinstitute/homebrew-tap.git", branch: "master"

  depends_on "fd"
  depends_on "jq"
  depends_on "pi-coding-agent"
  depends_on "ripgrep"

  def install
    bin.install "berges/bin/berges"
    pkgshare.install "berges/extension"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/berges --version")
  end
end
