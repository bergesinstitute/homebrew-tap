class Berges < Formula
  desc "Berges AI as an agent in your terminal, built on pi"
  homepage "https://berges.ai/help/use-berges-ai-in-your-terminal"
  url "https://github.com/bergesinstitute/homebrew-tap/archive/refs/tags/berges-v0.2.5.tar.gz"
  sha256 "cc29731d841ba044577571c028164f8f6eb344d27a76c5456d5c599c3f612353"
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
