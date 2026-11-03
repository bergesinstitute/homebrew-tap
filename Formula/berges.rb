class Berges < Formula
  desc "Berges AI as an agent in your terminal, built on pi"
  homepage "https://berges.ai/help/use-berges-ai-in-your-terminal"
  url "https://github.com/bergesinstitute/homebrew-tap/archive/refs/tags/berges-v0.2.1.tar.gz"
  sha256 "ec151423990a240fc3ebc2d27e9c1a4a5d5a0405e9ac6ae693daac7e62505b6e"
  head "https://github.com/bergesinstitute/homebrew-tap.git", branch: "master"

  depends_on "fd"
  depends_on "jq"
  depends_on "pi-coding-agent"
  depends_on "ripgrep"

  def install
    bin.install "berges/bin/berges"
    pkgshare.install "berges/extension"
    pkgshare.install "berges/themes"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/berges --version")
  end
end
