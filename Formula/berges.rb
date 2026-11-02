class Berges < Formula
  desc "Berges AI as an agent in your terminal, built on pi"
  homepage "https://berges.ai/help/use-berges-ai-in-your-terminal"
  url "https://github.com/bergesinstitute/homebrew-tap/archive/refs/tags/berges-v0.2.0.tar.gz"
  sha256 "e90a661bca0448fa08a9726b704c5364b56387f30191c53bae1b7731926b8215"
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
