class Berges < Formula
  desc "Berges AI as an agent in your terminal, built on pi"
  homepage "https://berges.ai/help/use-berges-ai-in-your-terminal"
  url "https://github.com/bergesinstitute/homebrew-tap/archive/refs/tags/berges-v0.2.11.tar.gz"
  sha256 "ebddf3090d39ecfd5b423b0c490326107643f78f27c3d127476735d14d8331be"
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
