class Berges < Formula
  desc "Berges AI as an agent in your terminal, powered by goose"
  homepage "https://berges.ai/help/use-berges-ai-in-your-terminal"
  url "https://github.com/bergesinstitute/homebrew-tap/archive/refs/tags/berges-v0.1.0.tar.gz"
  sha256 "45a386fdfc79602c781ddb494696ee07a8da7ac0148d0d78243c440fe217cbeb"
  head "https://github.com/bergesinstitute/homebrew-tap.git", branch: "master"

  depends_on "block-goose-cli"
  depends_on "jq"

  def install
    bin.install "berges/bin/berges"
    pkgshare.install "berges/sprites"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/berges --version")
  end
end
